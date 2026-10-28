import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const rail = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/src/components/LayerRail.vue'),
  'utf8',
)

describe('bottom-left weather chips', () => {
  test('individual pills sit above the timeline, not a single panel', () => {
    assert.match(rail, /bottom: 80px/)
    assert.match(rail, /left: 16px/)
    assert.doesNotMatch(rail, /top: 72px/)
    assert.match(rail, /layersOpen/)
    assert.match(rail, /class="fold"/)
    assert.match(rail, /aria-expanded/)
    assert.match(rail, /box-shadow: var\(--shadow-pill\)/)
    assert.doesNotMatch(rail, /background: rgba\(15, 23, 42/)
  })
})
