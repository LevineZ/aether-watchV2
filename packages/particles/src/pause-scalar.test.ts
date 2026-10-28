import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'

describe('temp/precip particles stay paused', () => {
  test('showParticles is wind/ocean only; precip speed is 0', () => {
    const src = readFileSync(new URL('./particle-layer.ts', import.meta.url), 'utf8')
    assert.match(src, /showParticles\(\): boolean \{\n\s+return this\.kind === 'wind' \|\| this\.kind === 'ocean'/s)
    assert.match(src, /precip: \{[\s\S]*?speed: 0/)
    assert.match(src, /kind === 'temp' \|\| kind === 'precip'/)
  })
})
