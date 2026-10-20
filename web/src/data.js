import data from 'virtual:lookbook-data'

export const { templates, categories, stats } = data

// Re-link component typography to the shared tokens (see the lookbook-data plugin).
for (const t of templates)
  for (const c of Object.values(t.tokens.components || {}))
    if (c?.typography?.$ref) c.typography = t.tokens.typography[c.typography.$ref]
export const bySlug = Object.fromEntries(templates.map((t) => [t.slug, t]))

// DESIGN.md bodies are only needed for the docs tab, copy and the AI prompt,
// so each one is its own lazily-loaded chunk.
const rawLoaders = Object.fromEntries(
  Object.entries(import.meta.glob('../../design-md/*/DESIGN.md', { query: '?raw', import: 'default' })).map(([p, load]) => [
    p.split('/').slice(-2)[0],
    load,
  ]),
)
const rawCache = {}

export function loadRaw(slug) {
  rawCache[slug] ??= rawLoaders[slug]?.() ?? Promise.resolve('')
  return rawCache[slug]
}

export const markdownBody = (raw) => raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
