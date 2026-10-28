import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = join(here, '../../../apps/web/src')

describe('no third-party weather tiles', () => {
  test('shaders and web sources do not point at Ventusky / Windy tile hosts', () => {
    const files = [
      join(here, 'shaders.ts'),
      join(here, 'particle-layer.ts'),
      join(webRoot, 'map/style.ts'),
      join(webRoot, 'map/basemap.ts'),
    ]
    const banned = /ventusky\.com|cdn\.ventusky|tile\.ventusky|windy\.com\/tiles|a\.windy/i
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      assert.equal(banned.test(src), false, file)
    }
  })
})
