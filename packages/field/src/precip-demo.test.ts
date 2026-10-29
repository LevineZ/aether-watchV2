import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function sample(scalar: Float32Array, nx: number, ny: number, lon: number, lat: number) {
  const ix = Math.round(((lon + 180) / 360) * (nx - 1))
  const iy = Math.round(((lat + 90) / 180) * (ny - 1))
  return scalar[iy * nx + ix]
}

describe('O3 DEMO precip blobs', () => {
  test('global precip meta is 721×361 DEMO and Gulf/Indonesia are wet', () => {
    const meta = JSON.parse(readFileSync(join(root, 'public/demo/global/precip/meta.json'), 'utf8'))
    assert.equal(meta.nx, 721)
    assert.equal(meta.ny, 361)
    assert.deepEqual(meta.bbox, [-180, -90, 180, 90])
    assert.equal(meta.meta.demo, true)
    const buf = readFileSync(join(root, 'public/demo/global/precip/scalar.bin'))
    const scalar = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    assert.equal(scalar.length, 721 * 361)
    assert.ok(sample(scalar, 721, 361, -90, 25) > 2, 'Gulf of Mexico should have DEMO rain')
    assert.ok(sample(scalar, 721, 361, 106.8, -6.2) > 2, 'Jakarta fringe should have DEMO rain')
    assert.ok(sample(scalar, 721, 361, 118, -2) > 2, 'Makassar Strait should have DEMO rain')
  })
})
