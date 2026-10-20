import { describe, it, expect, afterAll } from 'vitest'
import { templates } from '../src/data.js'
import { setLang } from '../src/i18n.js'
import { TABS, matchRoute, renderRoute, link, pageTitle } from '../src/views.js'

const BAD = /\bundefined\b|\bNaN\b|\[object Object\]/

afterAll(() => setLang('zh', { persist: false }))

describe('routing', () => {
  it('matches every page type, including dotted slugs', () => {
    expect(matchRoute('/', '').page).toBe('gallery')
    expect(matchRoute('/about/', '').page).toBe('about')
    expect(matchRoute('/compare/', '?a=stripe&b=x.ai')).toMatchObject({ page: 'compare', a: 'stripe', b: 'x.ai' })
    expect(matchRoute('/t/x.ai/', '')).toMatchObject({ page: 'detail', tab: 'preview' })
    expect(matchRoute('/t/mistral.ai/', '?tab=tokens').tab).toBe('tokens')
    expect(matchRoute('/t/stripe/', '?tab=bogus').tab).toBe('preview')
    expect(matchRoute('/t/does-not-exist/', '').page).toBe('404')
    expect(matchRoute('/nope', '').page).toBe('404')
  })

  it('round-trips every template link', () => {
    for (const t of templates) {
      const url = new URL(link.template(t.slug, 'export'), 'http://x')
      expect(matchRoute(url.pathname, url.search)).toMatchObject({ page: 'detail', tab: 'export' })
    }
  })
})

describe.each(['zh', 'en'])('rendering (%s)', (lang) => {
  setLang(lang, { persist: false })

  it('renders the static pages', () => {
    setLang(lang, { persist: false })
    for (const route of [{ page: 'gallery' }, { page: 'about' }, { page: '404' }, matchRoute('/compare/', '?a=stripe&b=voltagent')]) {
      const html = renderRoute(route)
      expect(html.length, route.page).toBeGreaterThan(500)
      expect(html, route.page).not.toMatch(BAD)
      expect(pageTitle(route)).toContain('Lookbook')
    }
  })

  it('renders every tab of every template without empty panels or bad values', () => {
    setLang(lang, { persist: false })
    for (const t of templates) {
      for (const tab of TABS) {
        const html = renderRoute({ page: 'detail', t, tab }, { docsHtml: '<article>docs</article>' })
        const panel = html.slice(html.indexOf('id="panel"'))
        expect(panel.replace(/<[^>]+>/g, '').trim().length, `${t.slug}/${tab}`).toBeGreaterThan(20)
        expect(html, `${t.slug}/${tab}`).not.toMatch(BAD)
      }
    }
  })
})
