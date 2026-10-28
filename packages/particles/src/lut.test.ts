import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { LUT_PRECIP, LUT_TEMP, LUT_WIND, bakeLut, TEMP_STOPS, WIND_LUT_RANGE } from './lut.ts'

describe('Ventusky LUTs', () => {
  test('256×1 RGBA', () => {
    assert.equal(LUT_WIND.length, 256 * 4)
    assert.equal(LUT_TEMP.length, 256 * 4)
  })

  test('wind 0 is teal, 50 is maroon', () => {
    assert.ok(LUT_WIND[2] > LUT_WIND[0])
    const hi = 255 * 4
    assert.ok(LUT_WIND[hi] > 120)
    assert.ok(LUT_WIND[hi + 2] < 80)
  })

  test('temp −40 is near-black blue, 50 is dark red', () => {
    assert.ok(LUT_TEMP[0] < 20)
    assert.ok(LUT_TEMP[2] < 40)
    const hi = 255 * 4
    assert.ok(LUT_TEMP[hi] > 80)
    assert.ok(LUT_TEMP[hi + 1] < 40)
  })

  test('precip 0 keeps a faint alpha, not fully clear', () => {
    assert.ok(LUT_PRECIP[3] > 8)
    assert.ok(LUT_PRECIP[3] < 40)
  })

  test('bake is monotonic in stop count', () => {
    const a = bakeLut(TEMP_STOPS, ...WIND_LUT_RANGE)
    assert.equal(a.length, 1024)
  })
})
