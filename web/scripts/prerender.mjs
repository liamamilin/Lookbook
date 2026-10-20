// Runs after `vite build`: writes a static, pre-rendered HTML file for every route
// (gallery, about, compare, each template, 404) plus Open Graph images, robots.txt
// and sitemap.xml, so pages are indexable, shareable and load with content.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Resvg } from '@resvg/resvg-js'
import config from '../lookbook.config.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist')
const base = process.env.LOOKBOOK_BASE || config.base || '/'
const siteUrl = (process.env.LOOKBOOK_SITE_URL || config.siteUrl || '').replace(/\/$/, '')
const abs = (p) => (siteUrl ? siteUrl + p : '')

const vite = await createServer({ root, base, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const views = await vite.ssrLoadModule('/src/views.js')
  const { templates } = await vite.ssrLoadModule('/src/data.js')
  const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

  function page(route, urlPath, ogImage) {
    const title = views.pageTitle(route)
    const desc = views.pageDescription(route).replace(/\s+/g, ' ').slice(0, 300)
    const head = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="Lookbook" />`,
      `<meta property="og:title" content="${escAttr(title)}" />`,
      `<meta property="og:description" content="${escAttr(desc)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      siteUrl && `<link rel="canonical" href="${escAttr(abs(urlPath))}" />`,
      siteUrl && `<meta property="og:url" content="${escAttr(abs(urlPath))}" />`,
      siteUrl && ogImage && `<meta property="og:image" content="${escAttr(abs(ogImage))}" />`,
      siteUrl && ogImage && `<meta name="twitter:image" content="${escAttr(abs(ogImage))}" />`,
    ]
      .filter(Boolean)
      .join('\n    ')
    return shell
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escAttr(title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
      .replace('<!--lookbook:head-->', head)
      .replace('<div id="app"></div>', `<div id="app">${views.renderRoute(route)}</div>`)
  }

  const write = (rel, html) => {
    const file = path.join(dist, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, html)
  }

  /* ---------- OG images (Latin text only: CI runners have no CJK fonts) ---------- */

  const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const FONT = `Helvetica, Arial, 'DejaVu Sans', sans-serif`
  const latin = (s) => String(s || '').replace(/[^\x20-\x7e—–·’]/g, '').trim()
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
  const solidColors = (t) =>
    (t.structured ? Object.values(t.tokens.colors) : (t.legacyColors || []).map((c) => c.value)).filter((v) => typeof v === 'string' && /^(#|rgb)/i.test(v.trim()))

  function png(svg) {
    return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng()
  }

  function templateOg(t) {
    const r = t.roles
    const strip = solidColors(t).slice(0, 10)
    const w = 1200 / Math.max(strip.length, 1)
    const tag = clip(latin(t.tagline), 64)
    const nameSize = t.name.length > 14 ? 96 : 128
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="${xml(r.canvas)}"/>
      <text x="80" y="110" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="4" fill="${xml(r.muted)}">LOOKBOOK</text>
      <text x="76" y="${170 + nameSize}" font-family="${FONT}" font-size="${nameSize}" font-weight="700" letter-spacing="-3" fill="${xml(r.ink)}">${xml(t.name)}</text>
      <text x="80" y="${240 + nameSize}" font-family="${FONT}" font-size="30" fill="${xml(r.body)}">${xml(tag)}</text>
      <rect x="80" y="${290 + nameSize}" width="250" height="64" rx="32" fill="${xml(r.primary)}" stroke="${xml(r.ink)}" stroke-opacity="0.15"/>
      <text x="205" y="${332 + nameSize}" text-anchor="middle" font-family="${FONT}" font-size="26" font-weight="700" fill="${xml(r.onPrimary)}">Get started</text>
      ${strip.map((c, i) => `<rect x="${i * w}" y="570" width="${w + 1}" height="60" fill="${xml(c)}"/>`).join('')}
    </svg>`
  }

  function defaultOg() {
    const strip = templates.map((t) => t.roles.primary).filter((c) => /^(#|rgb)/i.test(c))
    const w = 1200 / strip.length
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#f6f6f4"/>
      <g transform="translate(80 120) scale(5)">
        <rect x="2.5" y="6" width="17" height="21" rx="3.5" fill="#ff6a3d" transform="rotate(-8 11 16.5)"/>
        <rect x="11" y="4.5" width="18" height="23" rx="3.5" fill="#18181b"/>
        <circle cx="16.5" cy="11" r="2.2" fill="#ffd23f"/><circle cx="22.5" cy="11" r="2.2" fill="#3d7bff"/>
        <rect x="14.3" y="16.5" width="11" height="2.2" rx="1.1" fill="#f6f6f4"/><rect x="14.3" y="21" width="7" height="2.2" rx="1.1" fill="#f6f6f4"/>
      </g>
      <text x="260" y="230" font-family="${FONT}" font-size="120" font-weight="700" letter-spacing="-4" fill="#18181b">Lookbook</text>
      <text x="84" y="380" font-family="${FONT}" font-size="40" fill="#6b6b72">${templates.length} design systems, rendered from DESIGN.md</text>
      ${strip.map((c, i) => `<rect x="${i * w}" y="560" width="${w + 1}" height="70" fill="${xml(c)}"/>`).join('')}
    </svg>`
  }

  write('og/default.png', png(defaultOg()))
  for (const t of templates) write(`og/${t.slug}.png`, png(templateOg(t)))

  /* ---------- pages ---------- */

  const routes = [
    ['index.html', base, { page: 'gallery' }, 'og/default.png'],
    ['about/index.html', `${base}about/`, { page: 'about' }, 'og/default.png'],
    ['compare/index.html', `${base}compare/`, views.matchRoute(`${base}compare/`, ''), 'og/default.png'],
    ['404.html', `${base}404.html`, { page: '404' }, null],
    ...templates.map((t) => [`t/${t.slug}/index.html`, `${base}t/${encodeURIComponent(t.slug)}/`, { page: 'detail', t, tab: 'preview' }, `og/${t.slug}.png`]),
  ]
  for (const [file, urlPath, route, og] of routes) write(file, page(route, urlPath, og && base + og))

  /* ---------- robots / sitemap ---------- */

  const indexable = routes.filter(([f]) => f !== '404.html').map(([, u]) => u)
  write('robots.txt', `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${abs(base + 'sitemap.xml')}\n` : ''}`)
  if (siteUrl) {
    write(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((u) => `  <url><loc>${xml(abs(u))}</loc></url>`).join('\n')}\n</urlset>\n`,
    )
  }

  console.log(`prerendered ${routes.length} pages and ${templates.length + 1} OG images${siteUrl ? ` for ${siteUrl}` : ' (siteUrl not set: no og:image URLs or sitemap)'}`)
} finally {
  await vite.close()
}
