import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('Ventusky-like wind silk', () => {
  test('slow fade + thin low-alpha stamps, not teleporting ribbons', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.995/)
    assert.match(src, /TRAIL_GAIN = 0\.88/)
    assert.match(src, /drop: 0\.00008/)
    assert.match(src, /size: 1\.6/)
    assert.match(src, /trailStepUv/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(src, /Do not reseed on idle/)
  })
})
