// Pure parsing of CATALOG.md + DESIGN.md text into template data.
// No file access or bundler features here, so it runs in Vite (virtual module),
// Node (prerender) and tests alike.
import yaml from 'js-yaml'
import { luminance, toRgb, contrast, isColor } from './color.js'

/* ---------------- CATALOG.md: categories + taglines ---------------- */

export function parseReadme(text) {
  const meta = {}
  const order = []
  let category = null
  for (const line of text.split('\n')) {
    const h = line.match(/^###\s+(.+?)\s*$/)
    if (h) {
      category = h[1]
      continue
    }
    const m = line.match(/^-\s+\[\*\*(.+?)\*\*\]\(https:\/\/getdesign\.md\/([^/]+)\/design-md\)\s*-\s*(.*)$/)
    if (m && category) {
      const [, name, slug, tagline] = m
      meta[slug] = { name, tagline: tagline.trim(), category }
      if (!order.includes(category)) order.push(category)
    }
  }
  return { meta, order }
}

/* ---------------- token reference resolution ---------------- */

const REF_FULL = /^\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)\}$/
const REF_ANY = /\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)\}/g

function lookup(tokens, group, key) {
  const g = tokens[group]
  if (!g || typeof g !== 'object') return undefined
  return g[key]
}

function resolve(value, tokens, slug, stats, depth = 0) {
  if (depth > 8) return value
  if (typeof value === 'string') {
    const full = value.trim().match(REF_FULL)
    if (full) {
      const hit = lookup(tokens, full[1], full[2])
      if (hit === undefined) {
        stats.unresolved.push(`${slug}: ${value}`)
        return value
      }
      return resolve(hit, tokens, slug, stats, depth + 1)
    }
    if (value.includes('{')) {
      return value.replace(REF_ANY, (m, g, k) => {
        const hit = lookup(tokens, g, k)
        if (hit === undefined || typeof hit === 'object') {
          stats.unresolved.push(`${slug}: ${m}`)
          return m
        }
        return String(resolve(hit, tokens, slug, stats, depth + 1))
      })
    }
    return value
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolve(v, tokens, slug, stats, depth + 1)
    return out
  }
  return value
}

/* ---------------- legacy (no frontmatter) extraction ---------------- */

const COLOR_RE = /\*\*([^*\n]{1,60})\*\*[^(\n]{0,40}\(`?(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))`?\)\s*:?\s*(.*)/g

function extractLegacy(md) {
  const colors = []
  const seen = new Map()
  for (const m of md.matchAll(COLOR_RE)) {
    const [, name, value, desc] = m
    const key = `${name}|${value.toLowerCase()}`
    // The same colour is often listed under several roles; keep every description.
    if (seen.has(key)) {
      seen.get(key).desc += ` / ${desc.trim()}`
      continue
    }
    const entry = { name: name.trim(), value, desc: desc.trim() }
    seen.set(key, entry)
    colors.push(entry)
  }

  // Font families: first lines of the "Font Family" section.
  const fonts = []
  const ff = md.match(/###\s*Font Famil[^\n]*\n([\s\S]*?)(?=\n#{2,3}\s)/)
  if (ff) {
    for (const line of ff[1].split('\n')) {
      const m = line.match(/^-\s+\*\*([^*]+?)\*\*:?\s*:?\s*(.*)$/)
      if (!m) continue
      const [, role, rest] = m
      let stack
      if (rest.includes('`')) {
        // "`LamboType`, Roboto, Arial — description" -> "LamboType, Roboto, Arial"
        stack = rest.split(/\s+[—–]\s+|\. /)[0].replace(/`/g, '').replace(/(with )?fallbacks?:\s*/gi, '')
      } else if (/^\s*(\(|[—–]|fallback)/i.test(rest)) {
        // "**Manuka** (Klim Type Foundry) — fallback: Impact" -> the bold text is the family
        const fb = rest.match(/fallbacks?:\s*([^.]+)/i)
        stack = fb ? `${role}, ${fb[1]}` : role
      } else continue
      fonts.push({ role: role.replace(/:$/, ''), stack: stack.replace(/,\s*$/, '').trim() })
    }
  }

  // Display size from the first hierarchy row that mentions display/hero.
  let displaySize = 48
  const row = md.match(/^\|[^\n]*(Display|Hero)[^\n]*?\|[^\n]*?(\d{2,3})px/im)
  if (row) displaySize = Math.min(Number(row[2]), 96)

  return { colors, fonts, displaySize }
}

/* ---------------- role picking ---------------- */

function pick(colors, names) {
  for (const n of names) if (isColor(colors[n])) return colors[n]
  return undefined
}

// Figure out the handful of colours the mock page needs, with fallbacks.
function deriveRoles(colors) {
  const canvas = pick(colors, ['canvas', 'background', 'bg', 'surface', 'canvas-light', 'paper']) || '#ffffff'
  const dark = (luminance(canvas) ?? 1) < 0.25
  let ink = pick(colors, ['ink', 'text', 'foreground', 'on-canvas', 'heading'])
  if (!ink || contrast(ink, canvas) < 3) ink = dark ? '#f5f5f5' : '#111111'
  let body = pick(colors, ['body', 'ink-secondary', 'body-strong', 'muted', 'mute', 'ink-muted', 'ink-soft'])
  if (!body || contrast(body, canvas) < 2.5) body = ink
  let muted = pick(colors, ['muted', 'mute', 'ink-mute', 'ink-muted', 'stone', 'slate', 'muted-soft', 'on-dark-mute'])
  if (!muted || contrast(muted, canvas) < 2) muted = body
  const primary = pick(colors, ['primary', 'brand', 'accent']) || ink
  let onPrimary = pick(colors, ['on-primary', 'on-brand'])
  if (!onPrimary || contrast(onPrimary, primary) < 2) onPrimary = contrast('#ffffff', primary) > contrast('#000000', primary) ? '#ffffff' : '#000000'
  const surface =
    pick(colors, dark
      ? ['surface-card', 'surface', 'surface-dark-elevated', 'surface-elevated', 'surface-1', 'canvas-soft', 'surface-soft']
      : ['surface-card', 'canvas-soft', 'surface-soft', 'surface', 'surface-1', 'surface-strong']) || canvas
  const hairline = pick(colors, ['hairline', 'border', 'hairline-soft', 'divider', 'hairline-strong']) || (dark ? '#333333' : '#e5e5e5')
  const link = pick(colors, ['link', 'link-blue', 'primary']) || primary
  return { canvas, ink, body, muted, primary, onPrimary, surface, hairline, link, dark }
}

function deriveLegacyTokens(legacy) {
  const { colors, fonts, displaySize } = legacy
  // Try each pattern in priority order against "name: description".
  const by = (patterns, ok = () => true, exclude = /$^/) => {
    for (const re of patterns) {
      const hit = colors.find((c) => toRgb(c.value) && re.test(`${c.name}: ${c.desc}`) && !exclude.test(c.desc) && ok(c.value))
      if (hit) return hit
    }
  }
  const canvas =
    by([/page canvas|page background|dominant (surface|background)|primary canvas|default body background|deepest background/i, /canvas|background/i], () => true, /button|CTA/i)?.value || '#ffffff'
  const primaryC = by(
    [/primary CTA|CTA button|primary (brand|action)|sole accent|signature (acid|accent)|brand accent/i, /CTA|button|brand|accent/i],
    (v) => contrast(v, canvas) > 1.6,
    /never as a UI|logo|hover|pressed|disabled/i,
  ) || colors.find((c) => contrast(c.value, canvas) > 2)
  const textC = by(
    [/primary (headline|heading|text)|headline and body text|body text|heading/i, /text/i],
    (v) => contrast(v, canvas) > 4.5,
    /promo|link|accent|disabled|placeholder/i,
  )
  const flat = {}
  colors.forEach((c, i) => {
    const key = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `color-${i}`
    if (!(key in flat)) flat[key] = c.value
  })
  const display = fonts[0]?.stack || 'system-ui, sans-serif'
  const bodyFont = (fonts.find((f) => /body|ui|text/i.test(f.role)) || fonts[1] || fonts[0])?.stack || display
  return {
    colors: {
      ...flat,
      canvas,
      primary: primaryC?.value,
      ink: textC?.value,
    },
    typography: {
      display: { fontFamily: display, fontSize: `${displaySize}px`, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.5px' },
      body: { fontFamily: bodyFont, fontSize: '16px', fontWeight: 400, lineHeight: 1.5 },
      button: { fontFamily: bodyFont, fontSize: '15px', fontWeight: 500, lineHeight: 1 },
    },
  }
}

/* ---------------- main ---------------- */

function titleCase(slug) {
  return slug.replace(/[-.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function splitFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!m) return { fm: null, body: text }
  return { fm: m[1], body: m[2] }
}

// Some files have plain one-line top-level scalars containing ": " (invalid YAML).
// On failure, quote those lines and try once more.
function loadYaml(fm) {
  try {
    return yaml.load(fm) || null
  } catch (e) {
    const fixed = fm.replace(/^([^\s#:][^:\n]*?):[ \t]+(?!["'|>])(.+)$/gm, (_, k, v) => `${k}: ${JSON.stringify(v.trim())}`)
    return yaml.load(fixed) || null
  }
}

/**
 * @param {Record<string,string>} files  slug -> DESIGN.md text
 * @param {string} readme               root CATALOG.md text (categories + taglines)
 */
export function loadTemplates(files, readme) {
  const stats = { unresolved: [], parseErrors: [] }
  const { meta, order } = parseReadme(readme)
  const templates = []
  for (const [slug, text] of Object.entries(files)) {
    const { fm, body } = splitFrontmatter(text)
    let tokens = null
    let description = ''
    if (fm) {
      try {
        tokens = loadYaml(fm)
        description = typeof tokens?.description === 'string' ? tokens.description.trim() : ''
      } catch (e) {
        stats.parseErrors.push(`${slug}: ${e.message}`)
      }
    }
    const legacy = tokens ? null : extractLegacy(body)
    const sourceTokens = tokens || deriveLegacyTokens(legacy)
    const res = (v) => resolve(v || {}, sourceTokens, slug, stats)
    const resolved = {
      colors: res(sourceTokens.colors),
      typography: res(sourceTokens.typography),
      rounded: res(sourceTokens.rounded),
      spacing: res(sourceTokens.spacing),
      components: res(sourceTokens.components),
    }
    const m = meta[slug]
    templates.push({
      slug,
      name: m?.name || titleCase(slug),
      tagline: m?.tagline || '',
      category: m?.category || 'Other',
      description,
      structured: !!tokens,
      legacyColors: legacy?.colors || null,
      legacyFonts: legacy?.fonts || null,
      tokens: resolved,
      roles: deriveRoles(resolved.colors),
    })
  }
  templates.sort((a, b) => a.name.localeCompare(b.name))
  const categories = [...order]
  if (templates.some((t) => t.category === 'Other')) categories.push('Other')
  return { templates, categories, stats }
}
