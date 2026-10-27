import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { visualCount, zoomCountMul } from './lod.ts'

describe('n ∝ 1/zoom²', () => {
  test('higher zoom yields fewer particles', () => {
    assert.ok(zoomCountMul(1.35) > zoomCountMul(3.4))
    assert.ok(zoomCountMul(3.4) > zoomCountMul(5.1))
    const g = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 1.35 })
    const d = visualCount({ ocean: false, regionalWindow: true, density: 0.48, zoom: 3.4 })
    assert.ok(g > d)
    assert.ok(g > 8_000)
  })

  test('ocean freeze ignores zoom mul', () => {
    const a = visualCount({ ocean: true, regionalWindow: true, density: 0.48, zoom: 1.35 })
    const b = visualCount({ ocean: true, regionalWindow: true, density: 0.48, zoom: 6.2 })
    assert.equal(a, b)
    assert.equal(a, Math.floor(14_000 * 0.48))
  })
})
