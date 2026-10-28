import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseFieldFrameJson } from './parse-json.ts'

describe('parseFieldFrameJson', () => {
  test('spec wire format: lat ascending, lon −180–180, u/v length nx*ny', () => {
    const nx = 4
    const ny = 3
    const u = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const v = u.map((x) => -x)
    const frame = parseFieldFrameJson({
      meta: {
        nx,
        ny,
        lon0: -180,
        lat0: -90,
        dlon: 120,
        dlat: 90,
        lat_order: 'ascending',
        lon_order: 'ascending',
        kind: 'wind',
        unit: 'm/s',
        time: '2026-10-27T00:00:00Z',
        source: 'open-data',
      },
      u,
      v,
      data: null,
      mask: null,
      vmin: 0,
      vmax: 20,
    })
    assert.equal(frame.nx, 4)
    assert.equal(frame.ny, 3)
    assert.equal(frame.u.length, 12)
    assert.equal(frame.v.length, 12)
    assert.equal(frame.kind, 'wind')
    assert.deepEqual(frame.bbox, [-180, -90, 180, 90])
    assert.equal(frame.meta.lat_order, 'ascending')
    assert.equal(frame.u[0], 1)
    assert.equal(frame.u[11], 12)
  })

  test('descending lat is flipped to south→north', () => {
    const frame = parseFieldFrameJson({
      meta: {
        nx: 2,
        ny: 2,
        lon0: 0,
        lat0: 10,
        dlon: 10,
        dlat: -10,
        lat_order: 'descending',
        kind: 'temp',
        unit: '°C',
      },
      data: [30, 31, 10, 11],
    })
    assert.equal(frame.meta.lat_order, 'ascending')
    assert.equal(frame.bbox[1], 0)
    assert.equal(frame.bbox[3], 10)
    assert.equal(frame.scalar![0], 10)
    assert.equal(frame.scalar![2], 30)
  })

  test('0–360 lon rolls to −180–180', () => {
    const frame = parseFieldFrameJson({
      meta: {
        nx: 4,
        ny: 1,
        lon0: 0,
        lat0: 0,
        dlon: 90,
        dlat: 1,
        lon_order: '0-360',
        kind: 'wind',
      },
      u: [0, 1, 2, 3],
      v: [0, 0, 0, 0],
    })
    assert.ok(frame.bbox[0] <= -179)
    assert.ok(frame.bbox[2] <= 90)
    assert.equal(frame.u[0], 2)
    assert.equal(frame.u[2], 0)
  })

  test('null scalars become NaN', () => {
    const frame = parseFieldFrameJson({
      meta: { nx: 2, ny: 1, lon0: 10, lat0: 20, dlon: 1, dlat: 1, kind: 'precip' },
      data: [0.4, null],
    })
    assert.ok(Math.abs(frame.scalar![0] - 0.4) < 1e-6)
    assert.equal(Number.isFinite(frame.scalar![1]), false)
  })

  test('missing geo dims fail closed', () => {
    assert.throws(() => parseFieldFrameJson({ u: [1], v: [1] }), /无地理维/)
    assert.throws(() => parseFieldFrameJson(null), /格式不支持/)
  })
})
