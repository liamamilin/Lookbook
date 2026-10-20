// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderDocs } from '../src/docs.js'

describe('docs rendering', () => {
  it('renders markdown', async () => {
    expect(await renderDocs('# Title\n\n`code`')).toContain('<h1')
  })

  it('strips scripts, event handlers and javascript: links', async () => {
    const html = await renderDocs('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1))\n\n<a href="#" onclick="alert(1)">y</a>')
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:/i)
  })
})
