import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('GPGPU white glow-stick advection', () => {
  test('FBO fade 0.96, long life, visible step', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.96/)
    assert.match(src, /TRAIL_FADE_OCEAN = 0\.93/)
    assert.match(src, /TRAIL_DECAY = 0\.001/)
    assert.match(src, /WIND_SPEED_GLOBAL = 0\.18/)
    assert.match(src, /WIND_SPEED_DESK = 0\.09/)
    assert.match(src, /ADVECT_DEG_SCALE = 28/)
    assert.match(src, /drop: 0\.0008/)
    assert.match(src, /g\.drawArrays\(g\.LINES, 0, count \* 2\)/)
    assert.match(src, /this\.drawParticles\(g, matrix, count\)/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(shaders, /vel \* u_speed \* u_dt \* u_advect_scale/)
    assert.doesNotMatch(shaders, /dir \* nrm \* u_step/)
    assert.match(shaders, /r < u_drop_rate/)
    assert.match(shaders, /delta\.x > 0\.12/)
    assert.doesNotMatch(shaders, /delta\.x > 0\.015/)
    assert.match(shaders, /uniform sampler2D u_prev/)
  })

  test('wind stamps #FFFFFF silk, never speed-tinted; curtain is a watercolor wash', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /\[1, 1, 1, 0\.55\]/)
    assert.match(src, /size: 1\.3/)
    assert.match(src, /\[0\.498, 0\.831, 0\.91, 0\.55\]/)
    assert.match(src, /粒子禁止染风速色/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /#FFFFFF/)
    assert.match(shaders, /#7FD4E8/)
    assert.doesNotMatch(shaders, /texture\(u_lut, vec2\(nrm/)
    assert.match(shaders, /mix\(vec3\(luma\), rgb, 0\.5\)/)
    assert.match(shaders, /alpha = 0\.3/)
    assert.match(shaders, /if \(mask < 0\.5\) discard/)
  })
})
