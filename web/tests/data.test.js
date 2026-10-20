import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { templates, stats, categories } from '../src/data.js'

const dirs = fs.readdirSync(new URL('../../design-md', import.meta.url)).filter((d) => fs.existsSync(new URL(`../../design-md/${d}/DESIGN.md`, import.meta.url)))

describe('template data', () => {
  it('loads every DESIGN.md in design-md/', () => {
    expect(templates.map((t) => t.slug).sort()).toEqual(dirs.sort())
  })

  it('parses all frontmatter and resolves every token reference', () => {
    expect(stats.parseErrors).toEqual([])
    expect(stats.unresolved).toEqual([])
  })

  it('assigns every template a known category', () => {
    for (const t of templates) expect(categories).toContain(t.category)
  })

  it('derives usable colour roles for every template', () => {
    for (const t of templates) {
      for (const k of ['canvas', 'ink', 'primary', 'onPrimary', 'surface', 'hairline']) {
        expect(t.roles[k], `${t.slug}.${k}`).toMatch(/^(#|rgba?\()/i)
      }
    }
  })

  it('extracts colours and fonts from templates without frontmatter', () => {
    const legacy = templates.filter((t) => !t.structured)
    expect(legacy.length).toBeGreaterThan(0)
    for (const t of legacy) {
      expect(t.legacyColors.length, t.slug).toBeGreaterThan(3)
      expect(t.legacyFonts.length, t.slug).toBeGreaterThan(0)
    }
  })
})
