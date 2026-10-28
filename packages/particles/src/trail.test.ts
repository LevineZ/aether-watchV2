import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('kind-look silk trails', () => {
  test('fade + decay + cap, not immortal white-out', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.991/)
    assert.match(src, /TRAIL_DECAY = 0\.001/)
    assert.match(src, /TRAIL_CAP = 0\.42/)
    assert.match(src, /TRAIL_GAIN = 0\.88/)
    assert.match(src, /trailStepUv/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(shaders, /u_decay/)
    assert.match(shaders, /u_cap/)
    assert.match(shaders, /c = max\(c - vec4\(u_decay\), 0\.0\)/)
    assert.match(src, /Do not reseed on idle/)
  })

  test('wind stamps near-white; ocean stamps cyan-green', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /drop: 0\.00015/)
    assert.match(src, /size: 1\.9/)
    assert.match(src, /\[0\.96, 0\.98, 1\.0, 0\.28\]/)
    assert.match(src, /\[0\.14, 0\.78, 0\.68, 0\.32\]/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /oceanRamp\(nrm\)/)
    assert.match(shaders, /never the wind white hair/)
  })
})
