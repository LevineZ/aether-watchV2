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

  test('basemap coasts are 1px #888, not thick white hairlines', () => {
    const style = readFileSync(join(webRoot, 'map/style.ts'), 'utf8')
    assert.match(style, /id: 'coast-line'/)
    assert.match(style, /'line-color': '#888888'/)
    assert.match(style, /'line-width': 1/)
    assert.doesNotMatch(style, /'line-color': '#ffffff'[\s\S]{0,80}line-width': \['interpolate'/)
  })
})
