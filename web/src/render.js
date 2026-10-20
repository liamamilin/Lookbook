import { isColor, contrast, luminance } from './color.js'
import { tr } from './i18n.js'

/* ---------------- tiny utils ---------------- */

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const PX_PROPS = new Set(['fontSize', 'letterSpacing', 'height', 'width', 'rounded', 'padding'])

function cssValue(prop, v) {
  if (typeof v === 'number' && PX_PROPS.has(prop) && v !== 0) return `${v}px`
  return String(v)
}

// Turn an object of css declarations into an inline style string.
export function styleStr(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${String(v).replace(/"/g, "'")}`)
    .join(';')
}

export function px(v) {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  const n = parseFloat(v)
  if (/rem$/.test(v.trim())) return n * 16
  return n
}

// Drop undefined keys so `{ ...defaults, ...compStyle(c) }` keeps the defaults.
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

// The colour actually visible behind an element: solid fills only.
// Translucent fills (alpha < 0.5) count as see-through.
const solid = (bg, fallback) => {
  if (luminance(bg) == null) return fallback
  const a = String(bg).match(/rgba\([^)]*,\s*([\d.]+)\s*\)/)
  return a && Number(a[1]) < 0.5 ? fallback : bg
}

function fontFeature(f) {
  if (!f) return undefined
  return String(f)
    .split(',')
    .map((x) => `"${x.trim().replace(/["']/g, '')}"`)
    .join(', ')
}

// Typography token -> css declarations. `scale` caps oversize display tokens.
export function typo(t, { maxSize } = {}) {
  if (!t || typeof t !== 'object') return {}
  let size = px(t.fontSize)
  let ls = t.letterSpacing
  // px line-heights would not follow the font when we scale it down; use a ratio.
  let lh = t.lineHeight
  if (typeof lh === 'string' && /px$/.test(lh) && size > 0) lh = +(parseFloat(lh) / size).toFixed(3)
  if (maxSize && size > maxSize) {
    const ratio = maxSize / size
    size = maxSize
    if (typeof ls === 'string' && /px$/.test(ls)) ls = `${(parseFloat(ls) * ratio).toFixed(2)}px`
    else if (typeof ls === 'number') ls = `${(ls * ratio).toFixed(2)}px`
  }
  return clean({
    fontFamily: t.fontFamily,
    fontSize: Number.isFinite(size) ? `${size}px` : undefined,
    fontWeight: t.fontWeight,
    lineHeight: lh,
    letterSpacing: ls !== undefined ? cssValue('letterSpacing', ls) : undefined,
    fontFeatureSettings: fontFeature(t.fontFeature),
    textTransform: t.textTransform,
  })
}

// Component token -> css declarations.
export function compStyle(c, roles, opts = {}) {
  if (!c || typeof c !== 'object') return {}
  const s = {
    ...(typeof c.typography === 'object' ? typo(c.typography, opts) : {}),
    background: isColor(c.backgroundColor) || /gradient/.test(c.backgroundColor ?? '') ? c.backgroundColor : undefined,
    color: isColor(c.textColor) ? c.textColor : undefined,
    borderRadius: c.rounded !== undefined ? cssValue('rounded', c.rounded) : undefined,
    padding: c.padding !== undefined ? cssValue('padding', c.padding) : undefined,
    height: c.height !== undefined ? cssValue('height', c.height) : undefined,
    boxShadow: typeof c.shadow === 'string' ? c.shadow : undefined,
    textTransform: c.textTransform,
    textDecoration: c.textDecoration,
  }
  if (typeof c.border === 'string') s.border = c.border
  else if (isColor(c.borderColor)) s.border = `1px solid ${c.borderColor}`
  if (c.width !== undefined && !opts.noWidth) s.width = cssValue('width', c.width)
  return clean(s)
}

/* ---------------- picking things out of a template ---------------- */

const entries = (o) => Object.entries(o || {})

export function findComp(t, ...patterns) {
  const comps = entries(t.tokens.components)
  for (const re of patterns) {
    const hit = comps.find(([k, v]) => re.test(k) && v && typeof v === 'object')
    if (hit) return { key: hit[0], ...hit[1] }
  }
  return null
}

export function displayTypo(t) {
  const ty = entries(t.tokens.typography).filter(([, v]) => v && typeof v === 'object' && px(v.fontSize) > 0)
  const display = ty.filter(([k]) => /display|hero|headline|title|h1/i.test(k))
  const pool = display.length ? display : ty
  pool.sort((a, b) => px(b[1].fontSize) - px(a[1].fontSize))
  return pool[0]?.[1] || null
}

export function bodyTypo(t) {
  const ty = t.tokens.typography || {}
  for (const k of ['body-lg', 'body-large', 'lead', 'body-md', 'body', 'body-medium', 'paragraph', 'text-md']) {
    if (ty[k] && typeof ty[k] === 'object') return ty[k]
  }
  const hit = entries(ty).find(([k, v]) => /body|text|paragraph/.test(k) && typeof v === 'object')
  return hit?.[1] || null
}

function headingTypo(t) {
  const ty = entries(t.tokens.typography).filter(([, v]) => v && typeof v === 'object')
  const hit =
    ty.find(([k]) => /^(heading|title|card-title|h3|headline)[-_]?(md|sm|lg|3)?$/i.test(k)) ||
    ty.find(([k, v]) => /heading|title|h3/i.test(k) && px(v.fontSize) <= 28)
  return hit?.[1] || null
}

function primaryButton(t) {
  return findComp(t, /^button-primary$/, /^button-primary/, /^(cta|btn)-primary/, /^button-(filled|solid|brand|cta)/, /^button(?!.*(secondary|ghost|outline|text|link|tertiary|disabled|pressed|hover|active|focus))/)
}
function secondaryButton(t) {
  return findComp(t, /^button-secondary$/, /^button-(secondary|outline|ghost|tertiary)(?!.*(pressed|hover|active|focus|disabled))/, /^(btn|cta)-(secondary|outline|ghost)/)
}

/* ---------------- mock landing page ---------------- */

// A button whose fill matches what's behind it (e.g. black-on-black ghost buttons)
// gets a hairline so its shape stays visible.
function ensureEdge(s, behind, edge) {
  const fill = solid(s.background, behind)
  if (!s.border && contrast(fill, behind) < 1.25) s.border = `1px solid ${edge}`
  return s
}

const bestOn = (bg) => (contrast('#ffffff', bg) > contrast('#111111', bg) ? '#ffffff' : '#111111')

// Last-resort guard: tokens written for text over photos/gradients (e.g. a white
// transparent nav) would vanish on our flat preview, so swap in a legible colour.
// Threshold is low on purpose so deliberately faint states (disabled) stay faithful.
function legible(s, behind) {
  const fill = solid(s.background, behind)
  if (s.color && contrast(s.color, fill) < 1.3) s.color = bestOn(fill)
  return s
}

function btnHtml(c, roles, label, fallbackPrimary, behind = roles.canvas) {
  const base = fallbackPrimary
    ? { background: roles.primary, color: roles.onPrimary, borderRadius: '8px', padding: '12px 20px' }
    : { background: 'transparent', color: roles.ink, border: `1px solid ${roles.hairline}`, borderRadius: '8px', padding: '12px 20px' }
  const s = legible(ensureEdge({ ...base, ...compStyle(c, roles, { noWidth: true }) }, behind, roles.ink), behind)
  return `<span class="pv-btn" style="${styleStr(s)}">${esc(label)}</span>`
}

export function mockPage(t) {
  const r = t.roles
  const disp = displayTypo(t)
  const body = bodyTypo(t)
  const heading = headingTypo(t)
  const nav = findComp(t, /^(top-)?nav(-bar|igation)?(-|$)/, /^(header|top-bar|global-nav)/)
  const hero = findComp(t, /^hero(-band|-section)?$/, /^hero/)
  const footer = findComp(t, /^footer/)
  const pBtn = primaryButton(t)
  const sBtn = secondaryButton(t)
  const tag = findComp(t, /^(pill|tag|badge|chip|eyebrow)/)

  const cardComps = entries(t.tokens.components)
    .filter(([k, v]) => /^(card|feature|tile)/.test(k) && v && typeof v === 'object' && !/(pressed|hover|active|focus)/.test(k))
    .slice(0, 3)
    .map(([key, v]) => ({ key, ...v }))
  while (cardComps.length < 3) cardComps.push(null)

  const heroBg = hero && (isColor(hero.backgroundColor) || /gradient/.test(hero.backgroundColor ?? '')) ? hero.backgroundColor : r.canvas
  const heroSolid = solid(heroBg, r.canvas)
  let heroInk = hero && isColor(hero.textColor) && hero.textColor !== 'transparent' ? hero.textColor : contrast(r.ink, heroSolid) > 3 ? r.ink : bestOn(heroSolid)
  if (contrast(heroInk, heroSolid) < 1.3) heroInk = bestOn(heroSolid)
  const bodyColor = contrast(r.body, heroSolid) > 2.5 ? r.body : heroInk

  const navStyle = {
    background: r.canvas,
    color: r.ink,
    padding: '16px 32px',
    borderBottom: `1px solid ${r.hairline}`,
    ...compStyle(nav, r, { noWidth: true }),
    ...(body ? typo({ ...body, fontSize: 14 }) : {}),
  }
  delete navStyle.height
  delete navStyle.borderRadius
  legible(navStyle, r.canvas)

  const cards = cardComps
    .map((c, i) => {
      const s = {
        background: r.surface,
        color: r.ink,
        border: `1px solid ${r.hairline}`,
        borderRadius: '12px',
        padding: '24px',
        ...compStyle(c, r, { noWidth: true }),
      }
      delete s.height
      legible(s, r.canvas)
      const titles = tr('cardTitles')
      const copy = tr('cardCopy')
      const muted = contrast(r.muted, s.background || r.surface) > 2 ? r.muted : 'inherit'
      return `<div class="pv-card" style="${styleStr(s)}">
        <div class="pv-card-icon" style="background:${esc(r.primary)}"></div>
        <div style="${styleStr({ ...typo(heading || disp, { maxSize: 22 }), margin: '0 0 8px' })}">${titles[i]}</div>
        <div style="${styleStr({ ...typo(body, { maxSize: 16 }), color: muted, opacity: muted === 'inherit' ? 0.75 : 1 })}">${copy[i]}</div>
        ${c ? `<div class="pv-tokname">${esc(c.key)}</div>` : ''}
      </div>`
    })
    .join('')

  const footerStyle = {
    background: r.canvas,
    color: r.muted,
    padding: '32px',
    borderTop: `1px solid ${r.hairline}`,
    ...compStyle(footer, r, { noWidth: true }),
    ...(body ? typo({ ...body, fontSize: 13 }) : {}),
  }
  delete footerStyle.borderRadius
  delete footerStyle.height
  legible(footerStyle, r.canvas)

  const tagHtml = tag
    ? `<span class="pv-tag" style="${styleStr(legible({ color: heroInk, ...compStyle(tag, r, { noWidth: true }), height: undefined }, heroSolid))}">${esc(tr('tagNew')(t.name))}</span>`
    : ''

  return `<div class="pv" style="${styleStr({ background: r.canvas, color: r.ink, ...typo(body) })}">
    <div class="pv-nav" style="${styleStr(navStyle)}">
      <span style="${styleStr({ ...typo(disp, { maxSize: 20 }), fontWeight: 700 })}">${esc(t.name)}</span>
      <span class="pv-navlinks">${tr('navLinks').map((x) => `<span>${x}</span>`).join('')}</span>
      ${btnHtml(pBtn, r, tr('signUp'), true)}
    </div>
    <div class="pv-hero" style="${styleStr({ background: heroBg, color: heroInk })}">
      ${tagHtml}
      <h1 style="${styleStr({ ...typo(disp, { maxSize: 72 }), margin: '20px 0 16px' })}">${tr('heroTitle')}</h1>
      <p style="${styleStr({ ...typo(body, { maxSize: 20 }), color: bodyColor, margin: '0 0 28px', maxWidth: '560px' })}">
        ${esc(tr('heroSub')(t.name))}
      </p>
      <div class="pv-ctas">${btnHtml(pBtn, r, tr('getStarted'), true, heroBg)}${btnHtml(sBtn, r, tr('talkSales'), false, heroBg)}</div>
    </div>
    <div class="pv-section" style="${styleStr({ background: r.canvas })}">
      <div class="pv-cards">${cards}</div>
    </div>
    <div class="pv-footer" style="${styleStr(footerStyle)}">
      <span>${esc(tr('footer')(t.name))}</span>
      <span class="pv-navlinks">${tr('footLinks').map((x) => `<span>${x}</span>`).join('')}</span>
    </div>
  </div>`
}

/* ---------------- compact gallery thumbnail ---------------- */

export function thumb(t) {
  const r = t.roles
  const disp = displayTypo(t)
  const pBtn = primaryButton(t)
  const swatches = paletteList(t)
    .filter((c) => isColor(c.value))
    .slice(0, 8)
    .map((c) => `<i style="background:${esc(c.value)}"></i>`)
    .join('')
  const btn = ensureEdge(
    { background: r.primary, color: r.onPrimary, borderRadius: '8px', ...compStyle(pBtn, r, { noWidth: true }), padding: '7px 14px', fontSize: '12px', height: undefined, letterSpacing: undefined, lineHeight: 1 },
    r.canvas,
    r.ink,
  )
  return `<div class="th" style="${styleStr({ background: r.canvas, color: r.ink })}">
    <div class="th-title" style="${styleStr({ ...typo(disp, { maxSize: 30 }), lineHeight: 1.05 })}">${esc(t.name)}</div>
    <span class="th-btn" style="${styleStr(btn)}">${tr('getStarted')}</span>
    <div class="th-swatches">${swatches}</div>
  </div>`
}

/* ---------------- tokens ---------------- */

export function paletteList(t) {
  if (!t.structured && t.legacyColors?.length) return t.legacyColors.map((c) => ({ name: c.name, value: c.value, desc: c.desc }))
  return entries(t.tokens.colors)
    .filter(([, v]) => typeof v === 'string')
    .map(([name, value]) => ({ name, value }))
}

export function paletteHtml(t) {
  return `<div class="swatches">${paletteList(t)
    .map((c) => {
      const ok = isColor(c.value)
      const fg = ok && contrast('#ffffff', c.value) > contrast('#000000', c.value) ? '#fff' : '#000'
      return `<button class="sw" data-copy="${esc(c.value)}" title="${tr('clickCopy')} ${esc(c.value)}">
        <span class="sw-chip" data-done="${tr('swCopied')}" style="background:${ok ? esc(c.value) : 'repeating-linear-gradient(45deg,#ccc 0 4px,#eee 4px 8px)'};color:${fg}">${esc(c.value)}</span>
        <span class="sw-name">${esc(c.name)}</span>
        ${c.desc ? `<span class="sw-desc">${esc(c.desc)}</span>` : ''}
      </button>`
    })
    .join('')}</div>`
}

export function typeScaleHtml(t) {
  const r = t.roles
  if (!t.structured) {
    const fonts = (t.legacyFonts || [])
      .map(
        (f) => `<div class="ts-row"><div class="ts-meta"><b>${esc(f.role)}</b><span>${esc(f.stack)}</span></div>
        <div class="ts-sample" style="${styleStr({ fontFamily: f.stack, fontSize: '32px', color: r.ink })}">${tr('pangramShort')}</div></div>`,
      )
      .join('')
    return `<div class="ts" style="background:${esc(r.canvas)}">${fonts || `<p class="empty">${tr('noFonts')}</p>`}</div>`
  }
  const rows = entries(t.tokens.typography)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => {
      const meta = [v.fontSize, v.fontWeight, v.lineHeight != null ? `lh ${v.lineHeight}` : null, v.letterSpacing != null ? `ls ${v.letterSpacing}` : null, v.fontFeature]
        .filter((x) => x != null && x !== '')
        .join(' · ')
      return `<div class="ts-row">
        <div class="ts-meta"><b>${esc(k)}</b><span>${esc(meta)}</span><span class="ts-family">${esc(String(v.fontFamily || '').split(',')[0])}</span></div>
        <div class="ts-sample" style="${styleStr({ ...typo(v, { maxSize: 64 }), color: r.ink })}">${px(v.fontSize) >= 28 ? tr('display') : tr('pangram')}</div>
      </div>`
    })
    .join('')
  return `<div class="ts" style="background:${esc(r.canvas)}">${rows}</div>`
}

export function scalesHtml(t) {
  const r = t.roles
  const rounded = entries(t.tokens.rounded)
    .map(
      ([k, v]) => `<div class="rd"><div class="rd-box" style="${styleStr({ borderRadius: cssValue('rounded', v), background: r.primary })}"></div><b>${esc(k)}</b><span>${esc(v)}</span></div>`,
    )
    .join('')
  const spacing = entries(t.tokens.spacing)
    .filter(([, v]) => Number.isFinite(px(v)))
    .map(
      ([k, v]) => `<div class="sp"><b>${esc(k)}</b><span class="sp-bar" style="width:${Math.min(px(v), 400)}px;background:${esc(r.primary)}"></span><span>${esc(v)}</span></div>`,
    )
    .join('')
  return `<div class="scales">
    <div><h3>${tr('radius')}</h3>${rounded ? `<div class="rds">${rounded}</div>` : `<p class="empty">${tr('none')}</p>`}</div>
    <div><h3>${tr('spacing')}</h3>${spacing || `<p class="empty">${tr('none')}</p>`}</div>
  </div>`
}

/* ---------------- components gallery ---------------- */

const TABLE_KEYS = ['headerBackground', 'rowBorder', 'cellPadding', 'headerTypography', 'bodyTypography']

function componentSample(key, c, r, stage) {
  const style = compStyle(c, r)
  // Solid fill without a text colour: choose a legible one rather than inheriting.
  const fill = solid(style.background, null)
  if (fill && !style.color && contrast(r.ink, fill) < 3) style.color = bestOn(fill)
  legible(style, stage)
  const k = key.toLowerCase()
  if (TABLE_KEYS.some((x) => x in c)) {
    const head = { background: c.headerBackground, ...typo(c.headerTypography, { maxSize: 14 }), padding: cssValue('padding', c.cellPadding ?? '8px 12px') }
    const cell = { ...typo(c.bodyTypography, { maxSize: 14 }), padding: head.padding, borderTop: typeof c.rowBorder === 'string' ? c.rowBorder : `1px solid ${r.hairline}` }
    return `<table class="cs-table" style="${styleStr({ ...style, borderCollapse: 'collapse' })}">
      <tr><th style="${styleStr(head)}">${tr('tablePlan')}</th><th style="${styleStr(head)}">${tr('tablePrice')}</th></tr>
      <tr><td style="${styleStr(cell)}">${tr('tableRows')[0]}</td><td style="${styleStr(cell)}">$0</td></tr>
      <tr><td style="${styleStr(cell)}">${tr('tableRows')[1]}</td><td style="${styleStr(cell)}">$24</td></tr></table>`
  }
  if (/input|field|search|select|textarea|dropdown/.test(k)) {
    return `<div class="cs-input" style="${styleStr({ border: `1px solid ${r.hairline}`, color: r.ink, ...style })}"><span style="opacity:.55">${/search/.test(k) ? tr('placeholderSearch') : 'you@example.com'}</span></div>`
  }
  if (/button|btn|cta/.test(k)) {
    return `<span class="cs-inline" style="${styleStr(ensureEdge({ ...style }, stage, contrast(r.ink, stage) >= 3 ? r.ink : bestOn(stage)))}">${/icon/.test(k) ? '→' : tr('getStarted')}</span>`
  }
  if (/pill|tag|badge|chip|label|eyebrow|status|kbd|avatar|toggle|switch|dot/.test(k)) {
    return `<span class="cs-inline" style="${styleStr(style)}">${/avatar/.test(k) ? 'AB' : tr('label')}</span>`
  }
  if (/^link|-link/.test(k)) {
    return `<span class="cs-inline" style="${styleStr(style)}">${tr('readDocs')}</span>`
  }
  if (/nav|header|footer|bar|banner|tab|breadcrumb|menu|toolbar/.test(k)) {
    return `<div class="cs-bar" style="${styleStr(style)}"><b>${tr('brand')}</b>${tr('items').map((x) => `<span>${x}</span>`).join('')}</div>`
  }
  if (/divider|rule|hairline|separator/.test(k)) {
    return `<div style="${styleStr({ ...style, minHeight: '1px', width: '100%' })}"></div>`
  }
  return `<div class="cs-block" style="${styleStr(style)}"><div style="font-weight:600;margin-bottom:6px">${esc(key)}</div><div style="opacity:.75">${tr('sampleContent')}</div></div>`
}

export function componentsHtml(t) {
  const r = t.roles
  const comps = entries(t.tokens.components).filter(([, v]) => v && typeof v === 'object')
  if (!comps.length) return `<p class="empty">${tr('noComps')}</p>`
  return `<div class="comps">${comps
    .map(([key, c]) => {
      // Pick a stage colour the component is legible on (e.g. *-on-dark parts on a light canvas).
      const own = compStyle(c, r)
      let stage = r.canvas
      const fill = solid(own.background, null)
      if (!fill && own.color && contrast(own.color, r.canvas) < 2) {
        const C = t.tokens.colors
        const cands = [C['surface-dark'], C['canvas-dark'], C['inverse-canvas'], C['canvas-light'], r.ink, '#ffffff', '#111111'].filter((x) => luminance(x) != null)
        stage = cands.find((x) => contrast(own.color, x) >= 3) || cands.sort((a, b) => contrast(own.color, b) - contrast(own.color, a))[0]
      }
      const stageInk = contrast(r.ink, stage) >= 3 ? r.ink : bestOn(stage)
      const specs = Object.entries(c)
        .filter(([k]) => k !== 'description')
        .map(([k, v]) => `<span><em>${esc(k)}</em> ${esc(typeof v === 'object' ? `${v.fontSize ?? ''} / ${v.fontWeight ?? ''}` : v)}</span>`)
        .join('')
      return `<div class="comp">
        <div class="comp-stage" style="${styleStr({ background: stage, color: stageInk })}">${componentSample(key, c, r, stage)}</div>
        <div class="comp-info"><code>${esc(key)}</code>${c.description ? `<p>${esc(c.description)}</p>` : ''}<div class="comp-specs">${specs}</div></div>
      </div>`
    })
    .join('')}</div>`
}
