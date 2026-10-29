import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { visualCount, zoomCountMul, WIND_COUNT_MIN, WIND_COUNT_MAX } from './lod.ts'

describe('n ∝ 1/zoom²', () => {
  test('higher zoom yields a smaller zoom multiplier', () => {
    assert.ok(zoomCountMul(1.35) > zoomCountMul(3.4))
    assert.ok(zoomCountMul(3.4) > zoomCountMul(5.1))
  })

  test('on-screen wind count is locked to 20,000–30,000', () => {
    const g = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 1.35 })
    const d = visualCount({ ocean: false, regionalWindow: true, density: 0.48, zoom: 3.4 })
    const desk = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 3.85 })
    const hi = visualCount({ ocean: false, regionalWindow: false, density: 1, zoom: 1.35 })
    const lo = visualCount({ ocean: false, regionalWindow: false, density: 0.2, zoom: 1.35 })
    for (const n of [g, d, desk, hi, lo]) {
      assert.ok(n >= WIND_COUNT_MIN, `${n} ≥ ${WIND_COUNT_MIN}`)
      assert.ok(n <= WIND_COUNT_MAX, `${n} ≤ ${WIND_COUNT_MAX}`)
    }
    assert.ok(hi > lo)
  })

  test('ocean is ~85% of wind at the same zoom', () => {
    const w = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 1.35 })
    const o = visualCount({ ocean: true, regionalWindow: false, density: 0.48, zoom: 1.35 })
    assert.ok(o < w * 0.95)
    assert.ok(o > w * 0.7)
  })

  test('precip never emits particles', () => {
    assert.equal(visualCount({ ocean: false, precip: true, regionalWindow: false, density: 1, zoom: 1.35 }), 0)
  })
})
