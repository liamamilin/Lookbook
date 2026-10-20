import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTemplates } from './src/core.js'
import config from './lookbook.config.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const designDir = path.join(repoRoot, 'design-md')
const readmePath = path.join(repoRoot, 'README.md')
const base = process.env.LOOKBOOK_BASE || config.base || '/'

const VIRTUAL_ID = 'virtual:lookbook-data'
const RESOLVED_ID = '\0' + VIRTUAL_ID

// Parses every ../design-md/*/DESIGN.md at build time and exposes the token data
// (without the markdown bodies, which are lazy-loaded per template) as a virtual module.
function lookbookData() {
  return {
    name: 'lookbook-data',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const files = {}
      for (const slug of fs.readdirSync(designDir)) {
        const file = path.join(designDir, slug, 'DESIGN.md')
        if (!fs.existsSync(file)) continue
        this.addWatchFile(file)
        files[slug] = fs.readFileSync(file, 'utf8')
      }
      this.addWatchFile(readmePath)
      const data = loadTemplates(files, fs.readFileSync(readmePath, 'utf8'))
      // Components embed full copies of their typography tokens; ship a key instead
      // and let data.js point them back at the shared object.
      for (const t of data.templates) {
        const typo = Object.entries(t.tokens.typography || {})
        for (const c of Object.values(t.tokens.components || {})) {
          if (!c || typeof c.typography !== 'object') continue
          const hit = typo.find(([, v]) => JSON.stringify(v) === JSON.stringify(c.typography))
          if (hit) c.typography = { $ref: hit[0] }
        }
      }
      return `export default ${JSON.stringify(data)}`
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(designDir) || file === readmePath) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}

// Client-side routes such as /t/x.ai/ look like files to the dev server; serve index.html.
function spaFallback() {
  const routes = /^(t\/|compare\/?|about\/?)/
  const rewrite = (req, _res, next) => {
    const url = req.url || ''
    const rel = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '')
    if (routes.test(rel) && (req.headers.accept || '').includes('text/html')) req.url = base + 'index.html'
    next()
  }
  return {
    name: 'lookbook-spa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// Optional analytics script from lookbook.config.js.
function analytics() {
  return {
    name: 'lookbook-analytics',
    transformIndexHtml() {
      const { src, attrs = {} } = config.analytics || {}
      if (!src) return []
      return [{ tag: 'script', attrs: { defer: true, src, ...attrs }, injectTo: 'head' }]
    },
  }
}

export default defineConfig({
  base,
  plugins: [lookbookData(), spaFallback(), analytics()],
  define: {
    __LOOKBOOK_FEEDBACK__: JSON.stringify(config.feedbackUrl || ''),
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
    fs: { allow: [repoRoot] },
  },
  preview: { host: '127.0.0.1', port: 5179 },
  test: {
    environment: 'node',
  },
})
