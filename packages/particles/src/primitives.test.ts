import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { visualCount } from './lod.ts'

describe('kind primitive table', () => {
  test('particles only for wind and ocean', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /export function usesParticlePass/)
    assert.match(src, /return kind === 'wind' \|\| kind === 'ocean'/)
    assert.equal(visualCount({ ocean: false, precip: true, regionalWindow: false, density: 0.48, zoom: 1.35 }), 0)
  })

  test('ocean particles are colder, thinner, slower, sparser than wind', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /size: 1\.55/)
    assert.match(src, /size: 0\.78/)
    assert.match(src, /WIND_SPEED_GLOBAL \* 0\.4/)
    assert.match(src, /\[0\.498, 0\.831, 0\.91, 0\.22\]/)
    const w = visualCount({ ocean: false, regionalWindow: false, density: 0.48, zoom: 1.35 })
    const o = visualCount({ ocean: true, regionalWindow: false, density: 0.48, zoom: 1.35 })
    assert.ok(o <= Math.floor(w * 0.35) + 1)
    assert.ok(o >= Math.floor(w * 0.25))
  })

  test('shaders branch by kind: precip fbm, no rain ribbons in render', () => {
    const layer = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    const shaders = readFileSync(new URL('./shaders.ts', import.meta.url), 'utf8')
    assert.match(layer, /渲染原语分配表/)
    assert.match(layer, /precip[\s\S]*否/)
    assert.match(shaders, /fbm3/)
    assert.match(shaders, /radar-style blobs/)
    assert.match(shaders, /smooth color curtain only/)
    assert.match(shaders, /frost-blue/)
    assert.doesNotMatch(layer, /kind === 'precip'[\s\S]{0,120}drawRibbons/)
    assert.match(layer, /if \(particlesOn && count > 0\) \{/)
  })
})
