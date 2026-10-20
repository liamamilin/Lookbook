// @vitest-environment jsdom
// Every visible text element in previews and component samples must stand out from
// what is behind it. jsdom does not cascade `color`, so walk the inline styles ourselves.
import { describe, it, expect } from 'vitest'
import { templates } from '../src/data.js'
import { mockPage, componentsHtml } from '../src/render.js'
import { contrast, luminance } from '../src/color.js'

// Disabled-state components are deliberately faint in their source tokens.
const allowed = (comp) => /disabled/.test(comp || '')

const isSolid = (bg) => {
  if (!bg || luminance(bg) == null) return false
  const a = bg.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/)
  return !a || Number(a[1]) >= 0.5
}

function inherited(el, prop) {
  for (let n = el; n && n.style; n = n.parentElement) if (n.style[prop]) return n.style[prop]
  return null
}

function background(el) {
  for (let n = el; n && n.style; n = n.parentElement) {
    if (/gradient|url\(/.test(n.getAttribute('style') || '')) return null // can't judge
    const bg = n.style.backgroundColor || n.style.background
    if (isSolid(bg)) return bg
  }
  return '#ffffff'
}

function lowContrast(html) {
  document.body.innerHTML = html
  const bad = []
  for (const el of document.querySelectorAll('h1, p, span, div, td, th, b')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const fg = inherited(el, 'color')
    const bg = background(el)
    if (!fg || !bg || luminance(fg) == null || /rgba\([^)]*,\s*0?\.[0-2]\d*\s*\)/.test(fg)) continue
    const r = contrast(fg, bg)
    if (r < 1.5) {
      const comp = el.closest('.comp')?.querySelector('code')?.textContent
      bad.push({ comp, text: el.textContent.trim().slice(0, 20), r: +r.toFixed(2) })
    }
  }
  return bad
}

describe('text stays legible', () => {
  it.each(templates.map((t) => [t.slug, t]))('%s', (slug, t) => {
    const bad = [...lowContrast(mockPage(t)), ...lowContrast(componentsHtml(t))].filter((b) => !allowed(b.comp))
    expect(bad).toEqual([])
  })
})
