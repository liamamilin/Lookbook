import { describe, it, expect } from 'vitest'
import { templates } from '../src/data.js'
import { toCSS, toTailwind4, toTailwind3, toDTCG, toPrompt } from '../src/export.js'

const BAD = /\bundefined\b|\bNaN\b|\[object Object\]/

describe.each(templates.map((t) => [t.slug, t]))('exports for %s', (slug, t) => {
  it('CSS variables are well-formed', () => {
    const css = toCSS(t)
    expect(css).not.toMatch(BAD)
    expect(css).not.toMatch(/\{(colors|typography|rounded|spacing)\./)
    expect((css.match(/\{/g) || []).length).toBe((css.match(/\}/g) || []).length)
    expect(css).toMatch(/--color-[\w-]+: (#|rgb)/)
    for (const line of css.split('\n').filter((l) => l.trim().startsWith('--'))) expect(line.trim(), line).toMatch(/^--[a-z0-9-]+: .+;$/)
  })

  it('Tailwind v4 theme is well-formed', () => {
    const css = toTailwind4(t)
    expect(css).toContain('@theme {')
    expect(css).not.toMatch(BAD)
  })

  it('Tailwind v3 config evaluates', () => {
    const module = {}
    new Function('module', toTailwind3(t))(module)
    expect(Object.keys(module.exports.theme.extend.colors || {}).length).toBeGreaterThan(0)
  })

  it('DTCG JSON parses and every token has $type/$value', () => {
    const json = JSON.parse(toDTCG(t))
    for (const [group, tokens] of Object.entries(json)) {
      if (group.startsWith('$')) continue
      for (const [k, tok] of Object.entries(tokens)) {
        expect(tok.$type, `${group}.${k}`).toBeTruthy()
        expect(tok.$value, `${group}.${k}`).toBeDefined()
      }
    }
  })

  it('AI prompt uses resolved values in both languages', () => {
    for (const lang of ['zh', 'en']) {
      const p = toPrompt(t, { lang, description: 'x', raw: '# DESIGN\n```css\na{}\n```' })
      expect(p).not.toMatch(BAD)
      expect(p).toContain(t.roles.primary)
      expect(p).toContain('````markdown')
    }
  })
})
