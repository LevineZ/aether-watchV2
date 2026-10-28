import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { percentileSorted, unitInterval } from './percentiles.ts'
import { TEMP_SCALAR_RANGE } from './types.ts'

describe('percentiles / temp scale', () => {
  test('percentileSorted interpolates', () => {
    assert.equal(percentileSorted([0, 10, 20, 30], 0), 0)
    assert.equal(percentileSorted([0, 10, 20, 30], 1), 30)
    assert.equal(percentileSorted([0, 10, 20, 30], 0.5), 15)
  })

  test('unitInterval never uses a fixed /24 span', () => {
    assert.equal(unitInterval(3, 0, 6), 0.5)
    assert.equal(unitInterval(12, 2, 12), 1)
    assert.equal(unitInterval(0, 0, 0), 0)
  })

  test('temp color window is −40…50', () => {
    assert.deepEqual(TEMP_SCALAR_RANGE, [-40, 50])
  })
})
