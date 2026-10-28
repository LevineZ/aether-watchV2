import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('GPGPU white tadpole advection', () => {
  test('short fade, 2% drop, speeds match the brief', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.38/)
    assert.match(src, /TRAIL_FADE_OCEAN = 0\.88/)
    assert.match(src, /TRAIL_DECAY = 0\.02/)
    assert.match(src, /WIND_SPEED_GLOBAL = 0\.18/)
    assert.match(src, /WIND_SPEED_DESK = 0\.09/)
    assert.match(src, /ADVECT_DEG_SCALE = 8\.5/)
    assert.match(src, /drop: 0\.02/)
    assert.match(src, /g\.drawArrays\(g\.LINES, 0, count \* 2\)/)
    assert.match(src, /this\.drawParticles\(g, matrix, count\)/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(shaders, /vel \* u_speed \* u_dt \* u_advect_scale/)
    assert.doesNotMatch(shaders, /dir \* nrm \* u_step/)
    assert.match(shaders, /r < u_drop_rate/)
    assert.match(shaders, /delta\.x > 0\.015/)
    assert.match(shaders, /uniform sampler2D u_prev/)
  })

  test('wind stamps #E8F4F8 tadpoles, never speed-tinted; ocean stays #7FD4E8', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /\[0\.91, 0\.957, 0\.973, 0\.6\]/)
    assert.match(src, /\[0\.498, 0\.831, 0\.91, 0\.55\]/)
    assert.match(src, /粒子禁止染风速色/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /#E8F4F8/)
    assert.match(shaders, /#7FD4E8/)
    assert.doesNotMatch(shaders, /texture\(u_lut, vec2\(nrm/)
    assert.match(shaders, /mix\(vec3\(luma\), rgb, 0\.52\)/)
    assert.match(shaders, /alpha = 0\.45/)
    assert.match(shaders, /if \(mask < 0\.5\) discard/)
  })
})
