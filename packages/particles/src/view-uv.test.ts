import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fieldViewUv } from './view-uv.ts'

const WORLD: [number, number, number, number] = [-180, -90, 180, 90]

describe('fieldViewUv', () => {
  test('East Asia camera is a subset of the global field, not a letterbox', () => {
    const uv = fieldViewUv({ west: 68, south: 6, east: 152, north: 54 }, WORLD)
    assert.ok(uv[0] > 0.55 && uv[0] < 0.75, `u0=${uv[0]}`)
    assert.ok(uv[2] > 0.85 && uv[2] < 0.98, `u1=${uv[2]}`)
    assert.ok(uv[1] > 0.45 && uv[1] < 0.6, `v0=${uv[1]}`)
    assert.ok(uv[3] > 0.75 && uv[3] <= 1, `v1=${uv[3]}`)
    assert.ok(uv[2] - uv[0] < 0.45, 'window must stay zoomed, not the whole globe')
  })

  test('full-world camera returns nearly the full UV square', () => {
    const uv = fieldViewUv({ west: -168, south: -52, east: 168, north: 72 }, WORLD)
    assert.ok(uv[2] - uv[0] > 0.85)
    assert.ok(uv[3] - uv[1] > 0.55)
  })
})
