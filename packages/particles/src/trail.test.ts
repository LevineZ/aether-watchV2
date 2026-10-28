import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('GPGPU physical silk trails', () => {
  test('wind fades slower than ocean; speeds match the brief', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /TRAIL_FADE = 0\.96/)
    assert.match(src, /TRAIL_FADE_OCEAN = 0\.88/)
    assert.match(src, /TRAIL_DECAY = 0\.002/)
    assert.match(src, /TRAIL_DECAY_OCEAN = 0\.006/)
    assert.match(src, /TRAIL_CAP = 0\.45/)
    assert.match(src, /WIND_SPEED_GLOBAL = 0\.18/)
    assert.match(src, /WIND_SPEED_DESK = 0\.09/)
    assert.match(src, /ADVECT_DEG_SCALE = 8\.5/)
    assert.match(src, /g\.drawArrays\(g\.LINES, 0, count \* 2\)/)
    assert.match(src, /Do not reseed on idle/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /c\.r \/ 255\.0 \+ c\.b/)
    assert.match(shaders, /c = max\(c - vec4\(u_decay\), 0\.0\)/)
    assert.match(shaders, /vel \* u_speed \* u_dt \* u_advect_scale/)
    assert.doesNotMatch(shaders, /dir \* nrm \* u_step/)
    assert.match(shaders, /texelFetch/)
    assert.match(shaders, /uniform sampler2D u_prev/)
  })

  test('wind stamps #E8F4F8; ocean stamps #7FD4E8 and discards land in FS', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /size: 1\.55/)
    assert.match(src, /size: 0\.78/)
    assert.match(src, /\[0\.91, 0\.957, 0\.973, 0\.5\]/)
    assert.match(src, /\[0\.498, 0\.831, 0\.91, 0\.38\]/)
    assert.match(src, /WIND_SPEED_GLOBAL \* 0\.4/)
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(shaders, /the only white streamline/)
    assert.match(shaders, /#7FD4E8/)
    assert.match(shaders, /#E8F4F8/)
    assert.match(shaders, /if \(mask < 0\.5\) discard/)
    assert.match(shaders, /float mask = texture\(u_wind, v_fieldUv\)\.b/)
  })
})
