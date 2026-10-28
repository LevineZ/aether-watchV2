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
    assert.ok(g > 6_500)
    const desk = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 3.85 })
    assert.ok(desk > 400)
    assert.ok(desk < 2_500)
  })

  test('ocean is ~30% of wind at the same zoom', () => {
    const w = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 1.35 })
    const o = visualCount({ ocean: true, regionalWindow: false, density: 0.48, zoom: 1.35 })
    assert.ok(o < w * 0.35)
    assert.ok(o > w * 0.25)
  })

  test('precip never emits particles', () => {
    assert.equal(visualCount({ ocean: false, precip: true, regionalWindow: false, density: 1, zoom: 1.35 }), 0)
  })
})
