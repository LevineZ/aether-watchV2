import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { LUT_WIDTH, TEMP_STOPS, PRECIP_STOPS, buildLut256, lutForOverlay } from './lut.ts'

describe('256×1 LINEAR LUTs', () => {
  test('temp LUT has ≥15 stops and 256 texels', () => {
    assert.ok(TEMP_STOPS.length >= 15)
    const lut = buildLut256(TEMP_STOPS)
    assert.equal(lut.length, LUT_WIDTH * 4)
    assert.equal(LUT_WIDTH, 256)
    const first = lut.subarray(0, 3)
    const last = lut.subarray((LUT_WIDTH - 1) * 4, (LUT_WIDTH - 1) * 4 + 3)
    assert.ok(first[0] > first[1], 'cold end is purple/blue, not yellow')
    assert.ok(last[0] > last[2], 'hot end is red')
  })

  test('precip LUT goes deep blue → cyan/green → yellow/orange', () => {
    assert.ok(PRECIP_STOPS.length >= 8)
    const lut = lutForOverlay('precip')
    assert.equal(lut.length, 256 * 4)
    assert.ok(lut[2] > lut[0], 'dry end is blue-dominant')
    const hot = lut.subarray(255 * 4, 255 * 4 + 3)
    assert.ok(hot[0] > hot[2], 'core is warm')
  })

  test('shaders sample the LUT with LINEAR bilinear field', () => {
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    const layer = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(shaders, /uniform sampler2D u_lut/)
    assert.match(shaders, /texture\(u_lut/)
    assert.match(shaders, /vec4 bilinear/)
    assert.match(shaders, /float dryA = 0\.02/)
    assert.match(shaders, /fbm3/)
    assert.match(shaders, /radar-style blobs/)
    assert.match(shaders, /smooth color curtain only/)
    assert.match(layer, /TEXTURE_MAG_FILTER, g\.LINEAR/)
    assert.match(layer, /LUT_WIDTH, 1/)
  })
})
