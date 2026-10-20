import { templates, stats, bySlug, loadRaw, markdownBody } from './data.js'
import { getLang, setLang, tr, describe } from './i18n.js'
import { toPrompt } from './export.js'
import { renderDocs } from './docs.js'
import { BASE, TABS, link, matchRoute, renderRoute, pageTitle, pageDescription, galleryGrid, filterTemplates } from './views.js'
import './style.css'

const app = document.getElementById('app')

// Exposed for auditing every template from the console / automation.
window.__lookbook = { templates, stats, slugs: templates.map((t) => t.slug), link }

const galleryState = { q: '', cat: 'all', mode: 'all' }

/* ---------------- navigation ---------------- */

function navigate(href, { replace = false } = {}) {
  const url = new URL(href, location.href)
  if (url.origin !== location.origin) return (location.href = href)
  history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash)
  render({ scroll: !replace })
}

// Old hash links (#/stripe/tokens) from the first version still work.
function upgradeHashUrl() {
  const m = location.hash.match(/^#\/([^/]+)(?:\/(\w+))?/)
  if (!m) return
  const slug = decodeURIComponent(m[1])
  if (bySlug[slug]) history.replaceState(null, '', link.template(slug, m[2]))
  else history.replaceState(null, '', BASE)
}

function setMeta(route) {
  document.title = pageTitle(route)
  document.querySelector('meta[name="description"]')?.setAttribute('content', pageDescription(route))
}

/* ---------------- render ---------------- */

function render({ scroll = true, focus = false } = {}) {
  const route = matchRoute(location.pathname, location.search)
  app.innerHTML = renderRoute(route, { state: galleryState })
  setMeta(route)
  if (scroll) window.scrollTo(0, 0)
  if (focus) document.getElementById('main')?.focus({ preventScroll: true })

  if (route.page === 'gallery') bindGallery()
  if (route.page === 'detail') bindDetail(route.t, route.tab)
  if (route.page === 'compare') bindCompare()
}

/* ---------------- gallery ---------------- */

function bindGallery() {
  const grid = app.querySelector('#grid')
  const count = app.querySelector('#count')
  const draw = () => {
    const list = filterTemplates(galleryState)
    grid.innerHTML = galleryGrid(list)
    count.textContent = `${list.length} / ${templates.length}`
  }
  app.querySelector('#q').addEventListener('input', (e) => {
    galleryState.q = e.target.value
    draw()
  })
  app.querySelector('.cats').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.cat) galleryState.cat = b.dataset.cat
    if (b.dataset.mode) galleryState.mode = galleryState.mode === b.dataset.mode ? 'all' : b.dataset.mode
    app.querySelectorAll('.cats button').forEach((x) => {
      const on = x.dataset.cat ? x.dataset.cat === galleryState.cat : x.dataset.mode === galleryState.mode
      x.classList.toggle('on', on)
      x.setAttribute('aria-pressed', on)
    })
    draw()
  })
}

/* ---------------- detail ---------------- */

function flash(btn, text) {
  const old = btn.dataset.label || btn.textContent
  btn.dataset.label = old
  btn.textContent = text
  setTimeout(() => (btn.textContent = old), 1400)
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text)
    if (btn) flash(btn, tr('copied'))
  } catch {
    if (btn) flash(btn, tr('copyFail'))
  }
}

function bindDetail(t, tab) {
  // Fetch the DESIGN.md up front so "copy" can write synchronously within the click
  // (Safari drops clipboard access after an await).
  let raw = null
  const rawReady = loadRaw(t.slug).then((r) => (raw = r))

  app.querySelector('#copy-md').addEventListener('click', (e) => {
    if (raw != null) copyText(raw, e.currentTarget)
    else rawReady.then((r) => copyText(r, e.currentTarget))
  })

  // Tabs: arrow keys move between tabs (WAI-ARIA tabs pattern).
  const tabs = [...app.querySelectorAll('[role="tab"]')]
  app.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement)
    if (i < 0) return
    let j = null
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length
    if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') j = 0
    if (e.key === 'End') j = tabs.length - 1
    if (j == null) return
    e.preventDefault()
    navigate(tabs[j].href, { replace: true })
    document.getElementById(`tab-${TABS[j]}`)?.focus()
  })

  if (tab === 'docs') {
    rawReady.then(async (r) => {
      const html = await renderDocs(markdownBody(r))
      const panel = app.querySelector('#panel')
      if (panel && matchRoute(location.pathname, location.search).tab === 'docs') panel.innerHTML = `<article class="md">${html}</article>`
    })
  }

  if (tab === 'export') {
    const box = app.querySelector('#prompt-full')
    const code = app.querySelector('#code-prompt')
    box.addEventListener('change', async () => {
      const full = box.checked ? await rawReady : ''
      code.textContent = toPrompt(t, { lang: getLang(), description: describe(t), raw: full })
    })
  }
}

/* ---------------- compare ---------------- */

function fitCompareFrames() {
  // Previews are laid out at a fixed 1200px and scaled down to the column width.
  app.querySelectorAll('.cmp-frame').forEach((frame) => {
    const inner = frame.firstElementChild
    const scale = Math.min(1, frame.clientWidth / 1200)
    inner.style.transform = `scale(${scale})`
    frame.style.height = `${inner.scrollHeight * scale}px`
  })
}

function bindCompare() {
  const go = (a, b) => navigate(link.compare(a, b), { replace: true })
  const A = app.querySelector('#cmp-a')
  const B = app.querySelector('#cmp-b')
  A.addEventListener('change', () => go(A.value, B.value))
  B.addEventListener('change', () => go(A.value, B.value))
  app.querySelector('#cmp-swap').addEventListener('click', () => go(B.value, A.value))
  app.querySelector('#cmp-random').addEventListener('click', () => {
    const pick = () => templates[Math.floor(Math.random() * templates.length)].slug
    const a = pick()
    let b = pick()
    while (b === a) b = pick()
    go(a, b)
  })
  fitCompareFrames()
}
new ResizeObserver(() => app.querySelector('.cmp-frame') && fitCompareFrames()).observe(document.body)

/* ---------------- global events ---------------- */

// Same-origin links are handled client-side.
app.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

  if (e.target.closest('#lang')) {
    setLang(getLang() === 'zh' ? 'en' : 'zh')
    const y = window.scrollY
    render({ scroll: false })
    window.scrollTo(0, y)
    app.querySelector('#lang')?.focus()
    return
  }

  const copyBtn = e.target.closest('[data-copy-target]')
  if (copyBtn) return copyText(document.getElementById(copyBtn.dataset.copyTarget).textContent, copyBtn)

  const dl = e.target.closest('[data-download]')
  if (dl) {
    const blob = new Blob([document.getElementById(dl.dataset.download).textContent], { type: 'text/plain' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: dl.dataset.filename })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    return
  }

  const sw = e.target.closest('[data-copy]')
  if (sw) {
    navigator.clipboard?.writeText(sw.dataset.copy).catch(() => {})
    sw.classList.add('copied')
    setTimeout(() => sw.classList.remove('copied'), 900)
    return
  }

  const a = e.target.closest('a[href]')
  if (!a || a.target || a.hasAttribute('download')) return
  const url = new URL(a.href, location.href)
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE) || url.hash) return
  e.preventDefault()
  const isTab = a.getAttribute('role') === 'tab'
  navigate(url.href, { replace: isTab })
  if (!isTab) document.getElementById('main')?.focus({ preventScroll: true })
})

window.addEventListener('popstate', () => render({ scroll: false }))

upgradeHashUrl()
render({ scroll: false })
