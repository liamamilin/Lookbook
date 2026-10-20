import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import zlib from 'node:zlib'
import { templates } from '../src/data.js'
import { bundleFiles } from '../src/export.js'
import { zip, crc32 } from '../src/zip.js'

const hasUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe('zip', () => {
  it('crc32 matches zlib', () => {
    const bytes = new TextEncoder().encode('Lookbook · 设计系统图鉴')
    expect(crc32(bytes)).toBe(zlib.crc32(bytes))
  })

  it.skipIf(!hasUnzip)('produces an archive unzip can extract byte-for-byte', () => {
    const files = [
      { name: 'kit/README.md', data: '# 中文 ✓\n' },
      { name: 'kit/empty.txt', data: '' },
      { name: 'kit/bin', data: new Uint8Array([0, 255, 1, 254]) },
    ]
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lookbook-zip-'))
    const file = path.join(dir, 'kit.zip')
    fs.writeFileSync(file, zip(files))
    execFileSync('unzip', ['-tq', file])
    execFileSync('unzip', ['-q', file, '-d', dir])
    expect(fs.readFileSync(path.join(dir, 'kit/README.md'), 'utf8')).toBe('# 中文 ✓\n')
    expect(fs.readFileSync(path.join(dir, 'kit/empty.txt'), 'utf8')).toBe('')
    expect([...fs.readFileSync(path.join(dir, 'kit/bin'))]).toEqual([0, 255, 1, 254])
    fs.rmSync(dir, { recursive: true })
  })
})

describe.each(templates.map((t) => [t.slug, t]))('export bundle for %s', (slug, t) => {
  it('contains every format under one folder', () => {
    const files = bundleFiles(t, { lang: 'zh', raw: '# raw', url: `https://example.com/t/${slug}/` })
    expect(files.map((f) => f.name)).toEqual(
      ['README.md', 'DESIGN.md', 'PROMPT.md', 'tokens.css', 'tailwind.theme.css', 'tailwind.config.cjs', 'tokens.json'].map((n) => `${slug}-lookbook/${n}`),
    )
    for (const f of files) expect(f.data, f.name).toBeTruthy()
    expect(files[0].data).toContain(`https://example.com/t/${slug}/`)
    expect(files[1].data).toBe('# raw')
    expect(() => JSON.parse(files[6].data)).not.toThrow()
  })
})
