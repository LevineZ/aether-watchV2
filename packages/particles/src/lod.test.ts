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
    assert.ok(g > 40_000)
    const desk = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 3.85 })
    assert.ok(desk > 5_000)
    assert.ok(desk < 25_000)
  })

  test('ocean thins with zoom and stays below wind', () => {
    const far = visualCount({ ocean: true, regionalWindow: true, density: 0.48, zoom: 1.35 })
    const near = visualCount({ ocean: true, regionalWindow: true, density: 0.48, zoom: 6.2 })
    assert.ok(far > near)
    const wind = visualCount({ ocean: false, regionalWindow: true, density: 0.48, zoom: 1.35 })
    assert.ok(wind > far)
  })
})
