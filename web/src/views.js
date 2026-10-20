// Every page as an HTML string. Pure: used by the client router and by the build-time prerenderer.
import { templates, categories, bySlug } from './data.js'
import { esc, thumb, mockPage, paletteHtml, typeScaleHtml, scalesHtml, componentsHtml, displayTypo, bodyTypo, typo, styleStr } from './render.js'
import { tr, catName, getLang, tagline, describe, searchText } from './i18n.js'
import { toCSS, toTailwind4, toTailwind3, toDTCG, toPrompt } from './export.js'

export const BASE = import.meta.env.BASE_URL || '/'
const FEEDBACK = typeof __LOOKBOOK_FEEDBACK__ !== 'undefined' ? __LOOKBOOK_FEEDBACK__ : ''

export const TABS = ['preview', 'tokens', 'components', 'export', 'docs']
const TAB_LABEL = { preview: 'tabPreview', tokens: 'tabTokens', components: 'tabComponents', export: 'tabExport', docs: 'tabDocs' }

/* ---------------- links ---------------- */

const enc = (s) => encodeURIComponent(s)
export const link = {
  home: () => BASE,
  template: (slug, tab) => `${BASE}t/${enc(slug)}/${tab && tab !== 'preview' ? `?tab=${tab}` : ''}`,
  compare: (a, b) => `${BASE}compare/${a ? `?a=${enc(a)}${b ? `&b=${enc(b)}` : ''}` : ''}`,
  about: () => `${BASE}about/`,
}

/* ---------------- shell ---------------- */

export const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <rect x="2.5" y="6" width="17" height="21" rx="3.5" fill="#ff6a3d" transform="rotate(-8 11 16.5)"/>
  <rect x="11" y="4.5" width="18" height="23" rx="3.5" fill="currentColor"/>
  <circle cx="16.5" cy="11" r="2.2" fill="#ffd23f"/><circle cx="22.5" cy="11" r="2.2" fill="#3d7bff"/>
  <rect x="14.3" y="16.5" width="11" height="2.2" rx="1.1" fill="var(--bg)"/><rect x="14.3" y="21" width="7" height="2.2" rx="1.1" fill="var(--bg)"/>
</svg>`

const UPSTREAM = 'https://github.com/VoltAgent/awesome-design-md'
const upstreamLink = () => `<a href="${UPSTREAM}" target="_blank" rel="noopener">VoltAgent/awesome-design-md</a>`

function header(active) {
  const nav = [
    ['gallery', link.home(), tr('gallery')],
    ['compare', link.compare(), tr('compare')],
    ['about', link.about(), tr('about')],
  ]
  return `<header class="top">
    <a class="brand" href="${link.home()}" aria-label="Lookbook">${LOGO}<span class="brand-name">Lookbook</span><span class="brand-tag">${tr('appTagline')}</span></a>
    <nav class="topnav" aria-label="Lookbook">
      ${nav.map(([k, href, label]) => `<a href="${href}"${k === active ? ' aria-current="page" class="on"' : ''}>${label}</a>`).join('')}
    </nav>
    <button class="lang" id="lang" type="button" aria-label="${tr('langLabel')}" lang="${getLang() === 'zh' ? 'en' : 'zh'}">${getLang() === 'zh' ? 'EN' : '中文'}</button>
  </header>`
}

function footer() {
  return `<footer class="foot">
    <span>${LOGO}Lookbook</span>
    <span>${tr('attribution')(upstreamLink())}</span>
    <span class="foot-links"><a href="${link.about()}">${tr('about')}</a>${FEEDBACK ? `<a href="${esc(FEEDBACK)}" target="_blank" rel="noopener">${tr('feedback')}</a>` : ''}</span>
  </footer>`
}

function shell(active, main) {
  return `<a class="skip" href="#main">${tr('skip')}</a>${header(active)}<main id="main" tabindex="-1">${main}</main>${footer()}`
}

/* ---------------- gallery ---------------- */

export function filterTemplates({ q = '', cat = 'all', mode = 'all' } = {}) {
  const needle = q.trim().toLowerCase()
  return templates.filter(
    (t) =>
      (cat === 'all' || t.category === cat) &&
      (mode === 'all' || (mode === 'dark') === t.roles.dark) &&
      (!needle || searchText(t).includes(needle)),
  )
}

export function galleryGrid(list) {
  if (!list.length) return `<p class="empty">${tr('noMatch')}</p>`
  return list
    .map(
      (t) => `<a class="card" href="${link.template(t.slug)}">
        ${thumb(t)}
        <div class="card-meta">
          <div class="card-name">${esc(t.name)}${t.structured ? '' : `<span class="badge" title="${tr('approxTitle')}">${tr('approx')}</span>`}</div>
          <div class="card-cat">${esc(catName(t.category))}</div>
          <div class="card-tag">${esc(tagline(t) || describe(t))}</div>
        </div></a>`,
    )
    .join('')
}

export function galleryPage(state = { q: '', cat: 'all', mode: 'all' }) {
  const counts = Object.fromEntries(categories.map((c) => [c, templates.filter((t) => t.category === c).length]))
  const list = filterTemplates(state)
  const pressed = (on) => `aria-pressed="${on}" class="${on ? 'on' : ''}"`
  return shell(
    'gallery',
    `<div class="toolbar">
      <label class="sr-only" for="q">${tr('searchLabel')}</label>
      <input id="q" class="search" type="search" placeholder="${tr('search')}" value="${esc(state.q)}" autocomplete="off" />
      <span class="count" id="count" aria-live="polite">${list.length} / ${templates.length}</span>
    </div>
    <div class="cats" role="group" aria-label="${tr('filterLabel')}">
      <button type="button" data-cat="all" ${pressed(state.cat === 'all')}>${tr('all')} <i>${templates.length}</i></button>
      ${categories.map((c) => `<button type="button" data-cat="${esc(c)}" ${pressed(state.cat === c)}>${esc(catName(c))} <i>${counts[c]}</i></button>`).join('')}
      <span class="cats-sep" aria-hidden="true"></span>
      <button type="button" data-mode="dark" ${pressed(state.mode === 'dark')}>${tr('dark')}</button>
      <button type="button" data-mode="light" ${pressed(state.mode === 'light')}>${tr('light')}</button>
    </div>
    <div class="grid" id="grid">${galleryGrid(list)}</div>`,
  )
}

/* ---------------- detail ---------------- */

function codeBlock(id, title, hint, code, filename) {
  return `<section class="xp" id="xp-${id}">
    <div class="xp-head">
      <div><h2>${title}</h2><p class="xp-hint">${esc(hint)}</p></div>
      <div class="xp-actions">
        <button type="button" class="btn" data-copy-target="code-${id}">${tr('copy')}</button>
        ${filename ? `<button type="button" class="btn" data-download="code-${id}" data-filename="${esc(filename)}">${tr('download')}</button>` : ''}
      </div>
    </div>
    <pre class="code"><code id="code-${id}">${esc(code)}</code></pre>
  </section>`
}

export function exportTab(t, raw = '') {
  const prompt = toPrompt(t, { lang: getLang(), description: describe(t) })
  return `${t.structured ? '' : `<p class="d-warn">${tr('exportApprox')}</p>`}
    <section class="xp" id="xp-prompt">
      <div class="xp-head">
        <div><h2>${tr('promptTitle')}</h2><p class="xp-hint">${tr('promptHint')}</p></div>
        <div class="xp-actions">
          <label class="check"><input type="checkbox" id="prompt-full"/> ${tr('includeFull')}</label>
          <button type="button" class="btn btn-primary" data-copy-target="code-prompt">${tr('copy')}</button>
        </div>
      </div>
      <pre class="code code-prompt"><code id="code-prompt">${esc(prompt)}</code></pre>
    </section>
    ${codeBlock('css', tr('cssTitle'), tr('cssHint'), toCSS(t), `${t.slug}.tokens.css`)}
    ${codeBlock('tw4', tr('tw4Title'), tr('tw4Hint'), toTailwind4(t), `${t.slug}.theme.css`)}
    ${codeBlock('tw3', tr('tw3Title'), tr('tw3Hint'), toTailwind3(t), 'tailwind.config.cjs')}
    ${codeBlock('dtcg', tr('dtcgTitle'), tr('dtcgHint'), toDTCG(t), `${t.slug}.tokens.json`)}`
}

function tabBody(t, tab, docsHtml) {
  if (tab === 'preview') return mockPage(t)
  if (tab === 'tokens')
    return `<section><h2>${tr('colors')}</h2>${paletteHtml(t)}</section>
      <section><h2>${tr('typography')}</h2>${typeScaleHtml(t)}</section>
      ${t.structured ? `<section><h2>${tr('scales')}</h2>${scalesHtml(t)}</section>` : ''}`
  if (tab === 'components') return componentsHtml(t)
  if (tab === 'export') return exportTab(t)
  return docsHtml || `<p class="empty">${tr('loading')}</p>`
}

export function detailPage(t, tab = 'preview', { docsHtml = '' } = {}) {
  const idx = templates.indexOf(t)
  const prev = templates[(idx - 1 + templates.length) % templates.length]
  const next = templates[(idx + 1) % templates.length]
  return shell(
    'gallery',
    `<div class="detail">
      <div class="d-head">
        <div>
          <div class="d-cat"><a href="${link.home()}">${tr('gallery')}</a> / ${esc(catName(t.category))} · <code>design-md/${esc(t.slug)}/DESIGN.md</code></div>
          <h1>${esc(t.name)}</h1>
          <p class="d-desc">${esc(describe(t) || tagline(t))}</p>
          ${t.structured ? '' : `<p class="d-warn">${tr('approxWarn')}</p>`}
        </div>
        <div class="d-actions">
          <button type="button" class="btn" id="copy-md">${tr('copyMd')}</button>
          <a class="btn" href="${link.compare(t.slug)}">${tr('compare')}</a>
        </div>
      </div>
      <div class="tabs" role="tablist" aria-label="${tr('tabsLabel')}">
        ${TABS.map(
          (k) =>
            `<a role="tab" id="tab-${k}" href="${link.template(t.slug, k)}" aria-selected="${k === tab}" aria-controls="panel" tabindex="${k === tab ? 0 : -1}" class="${k === tab ? 'on' : ''}">${tr(TAB_LABEL[k])}</a>`,
        ).join('')}
      </div>
      <div class="d-body d-${tab}" id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${tabBody(t, tab, docsHtml)}</div>
      <nav class="pager" aria-label="${tr('prev')} / ${tr('next')}">
        <a href="${link.template(prev.slug, tab)}" rel="prev">‹ ${esc(prev.name)}</a>
        <a href="${link.template(next.slug, tab)}" rel="next">${esc(next.name)} ›</a>
      </nav>
    </div>`,
  )
}

/* ---------------- compare ---------------- */

function selectFor(id, current) {
  return `<select id="${id}" class="select" aria-label="${id === 'cmp-a' ? 'A' : 'B'}">
    ${templates.map((t) => `<option value="${esc(t.slug)}"${t.slug === current ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}
  </select>`
}

function compareColumn(t, id) {
  const disp = displayTypo(t)
  const body = bodyTypo(t)
  return `<div class="cmp-col">
    <div class="cmp-pick">${selectFor(id, t.slug)}<a class="btn" href="${link.template(t.slug)}">${tr('viewDetail')}</a></div>
    <div class="cmp-frame"><div class="cmp-scale">${mockPage(t)}</div></div>
    <div class="cmp-swatches">${(t.structured ? Object.entries(t.tokens.colors).filter(([, v]) => typeof v === 'string').map(([k, v]) => ({ k, v })) : (t.legacyColors || []).map((c) => ({ k: c.name, v: c.value })))
      .slice(0, 16)
      .map((c) => `<span title="${esc(c.k)} ${esc(c.v)}" style="background:${esc(c.v)}"></span>`)
      .join('')}</div>
    <div class="cmp-type" style="${styleStr({ background: t.roles.canvas, color: t.roles.ink })}">
      <div style="${styleStr({ ...typo(disp, { maxSize: 40 }) })}">Aa ${esc(t.name)}</div>
      <div style="${styleStr({ ...typo(body, { maxSize: 16 }), opacity: 0.8 })}">${tr('pangram')}</div>
      <code>${esc(String(disp?.fontFamily || '').split(',')[0])} / ${esc(String(body?.fontFamily || '').split(',')[0])}</code>
    </div>
  </div>`
}

export function comparePage(a, b) {
  const A = bySlug[a] || templates[0]
  const B = bySlug[b] || templates.find((t) => t !== A && t.roles.dark !== A.roles.dark) || templates[1]
  return shell(
    'compare',
    `<div class="detail">
      <div class="d-head"><div><h1>${tr('compareTitle')}</h1><p class="d-desc">${tr('compareHint')}</p></div>
        <div class="d-actions"><button type="button" class="btn" id="cmp-swap">⇄ ${tr('swap')}</button><button type="button" class="btn" id="cmp-random">${tr('random')}</button></div>
      </div>
      <div class="cmp">${compareColumn(A, 'cmp-a')}${compareColumn(B, 'cmp-b')}</div>
    </div>`,
  )
}

/* ---------------- about / 404 ---------------- */

export function aboutPage() {
  return shell(
    'about',
    `<div class="detail prose">
      <h1>${tr('aboutTitle')}</h1>
      ${tr('aboutBody').map((p) => `<p>${esc(p)}</p>`).join('')}
      <h2>${tr('howTitle')}</h2>
      <ol>${tr('howSteps').map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <h2>${tr('creditsTitle')}</h2>
      <p>${tr('attribution')(upstreamLink())}</p>
      <p><a class="btn" href="${link.home()}">${tr('backHome')}</a></p>
    </div>`,
  )
}

export function notFoundPage() {
  return shell(
    '',
    `<div class="detail prose nf">
      <div class="nf-code">404</div>
      <h1>${tr('notFound')}</h1>
      <p>${tr('notFoundBody')}</p>
      <p><a class="btn btn-primary" href="${link.home()}">${tr('backHome')}</a></p>
    </div>`,
  )
}

/* ---------------- routing ---------------- */

// Map a URL (path relative to BASE + search) to a page descriptor.
export function matchRoute(pathname, search = '') {
  let rel = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '')
  rel = decodeURIComponent(rel).replace(/index\.html$/, '')
  const params = new URLSearchParams(search)
  if (rel === '' || rel === '/') return { page: 'gallery' }
  let m = rel.match(/^t\/([^/]+)\/?$/)
  if (m) {
    const t = bySlug[m[1]]
    if (!t) return { page: '404' }
    const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'preview'
    return { page: 'detail', t, tab }
  }
  if (/^compare\/?$/.test(rel)) return { page: 'compare', a: params.get('a'), b: params.get('b') }
  if (/^about\/?$/.test(rel)) return { page: 'about' }
  return { page: '404' }
}

export function pageTitle(route) {
  if (route.page === 'detail') return `${route.t.name} · Lookbook`
  if (route.page === 'compare') return `${tr('compareTitle')} · Lookbook`
  if (route.page === 'about') return `${tr('about')} · Lookbook`
  if (route.page === '404') return `${tr('notFound')} · Lookbook`
  return `Lookbook · ${tr('appTagline')}`
}

export function pageDescription(route) {
  if (route.page === 'detail') return describe(route.t) || tagline(route.t)
  return tr('aboutBody')[0]
}

export function renderRoute(route, opts = {}) {
  if (route.page === 'detail') return detailPage(route.t, route.tab, opts)
  if (route.page === 'compare') return comparePage(route.a, route.b)
  if (route.page === 'about') return aboutPage()
  if (route.page === '404') return notFoundPage()
  return galleryPage(opts.state)
}
