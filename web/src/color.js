// Colour maths shared by parsing, rendering and exports.

export function luminance(color) {
  const rgb = toRgb(color)
  if (!rgb) return null
  const [r, g, b] = rgb.map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function toRgb(color) {
  if (typeof color !== 'string') return null
  const c = color.trim()
  let m = c.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((x) => x + x).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (m) return [m[1], m[2], m[3]].map(Number)
  return null
}

export function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la == null || lb == null) return 1
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function isColor(v) {
  return typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|transparent$)/i.test(v.trim())
}
