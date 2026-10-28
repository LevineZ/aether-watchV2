import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('kind-look silk trails', () => {
  test('fade + decay + cap, ocean trails last longer than wind', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.988/)
    assert.match(src, /TRAIL_FADE_OCEAN = 0\.994/)
    assert.match(src, /TRAIL_DECAY = 0\.0012/)
    assert.match(src, /TRAIL_DECAY_OCEAN = 0\.00035/)
    assert.match(src, /TRAIL_CAP = 0\.4/)
    assert.match(src, /WIND_SPEED_GLOBAL = 0\.18/)
    assert.match(src, /WIND_SPEED_DESK = 0\.09/)
    assert.match(src, /trailStepUv/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(shaders, /c = max\(c - vec4\(u_decay\), 0\.0\)/)
    assert.match(src, /Do not reseed on idle/)
  })

  test('wind stamps near-white; ocean stamps #7FD4E8', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /size: 1\.55/)
    assert.match(src, /size: 0\.78/)
    assert.match(src, /\[0\.92, 0\.97, 1\.0, 0\.24\]/)
    assert.match(src, /\[0\.498, 0\.831, 0\.91, 0\.22\]/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /the only white streamline/)
    assert.match(shaders, /#7FD4E8/)
  })
})
