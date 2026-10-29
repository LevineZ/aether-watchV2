import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  assertGlobalPack,
  isGlobalDemoPack,
  isRegionalStamp,
  PAGE_KIND_PACK,
  packForKind,
} from './types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const WORLD = { nx: 721, ny: 361, bbox: [-180, -90, 180, 90] as [number, number, number, number] }
const STAMP = { nx: 141, ny: 131, bbox: [117.5, 22, 131.5, 35] as [number, number, number, number] }
const CHINA = { nx: 249, ny: 145, bbox: [73, 18, 135, 54] as [number, number, number, number] }

function readMeta(rel: string) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as {
    nx: number
    ny: number
    bbox: [number, number, number, number]
  }
}

describe('isGlobalDemoPack / packForKind', () => {
  test('only global/* ids count as global demo packs', () => {
    assert.equal(isGlobalDemoPack('global/wind'), true)
    assert.equal(isGlobalDemoPack('global/ocean'), true)
    assert.equal(isGlobalDemoPack('china/wind'), false)
    assert.equal(isGlobalDemoPack('regional/temp'), false)
    assert.equal(isGlobalDemoPack('forecast/china'), false)
  })

  test('global page mapping never returns regional or china packs', () => {
    for (const kind of ['wind', 'ocean', 'temp', 'precip'] as const) {
      const pack = packForKind('global', kind)
      assert.equal(pack, `global/${kind}`)
      assert.equal(PAGE_KIND_PACK.global[kind], pack)
    }
  })

  test('desk binds global packs so the East Asia camera is a window, not a china rectangle', () => {
    for (const kind of ['wind', 'ocean', 'temp', 'precip'] as const) {
      const pack = packForKind('desk', kind)
      assert.equal(pack, `global/${kind}`)
      assert.equal(isGlobalDemoPack(pack!), true)
    }
  })
})

describe('assertGlobalPack', () => {
  test('accepts ~721×361 full-world bbox', () => {
    assert.doesNotThrow(() => assertGlobalPack('global/wind', WORLD))
  })

  test('rejects 141×131 regional stamp even under a global/ id', () => {
    assert.equal(isRegionalStamp('global/temp', STAMP), true)
    assert.throws(() => assertGlobalPack('global/temp', STAMP), /禁止绑定区域包/)
  })

  test('rejects china/* and regional/* ids even with a world-sized frame', () => {
    assert.throws(() => assertGlobalPack('china/wind', WORLD), /禁止绑定区域包/)
    assert.throws(() => assertGlobalPack('regional/currents', WORLD), /禁止绑定区域包/)
    assert.throws(() => assertGlobalPack('forecast/china', WORLD), /禁止绑定区域包/)
  })

  test('rejects china grid and coarse 144×73 globe', () => {
    assert.throws(() => assertGlobalPack('global/wind', CHINA), /全球窗/)
    assert.throws(
      () => assertGlobalPack('global/wind', { nx: 144, ny: 73, bbox: WORLD.bbox }),
      /全球窗/,
    )
  })

  test('rejects short lon or lat span', () => {
    assert.throws(
      () => assertGlobalPack('global/wind', { nx: 721, ny: 361, bbox: [100, -90, 140, 90] }),
      /全球窗/,
    )
    assert.throws(
      () => assertGlobalPack('global/wind', { nx: 721, ny: 361, bbox: [-180, 0, 180, 10] }),
      /全球窗/,
    )
  })
})

describe('repo DEMO metas', () => {
  test('public/demo/global/* metas pass the global window contract', () => {
    for (const kind of ['wind', 'ocean', 'temp', 'precip'] as const) {
      const meta = readMeta(`public/demo/global/${kind}/meta.json`)
      assertGlobalPack(`global/${kind}`, meta)
      assert.equal(meta.nx, 721)
      assert.equal(meta.ny, 361)
      assert.deepEqual(meta.bbox, [-180, -90, 180, 90])
    }
  })

  test('regional and china metas cannot bind to the global tab', () => {
    const regional = readMeta('public/demo/regional/temp/meta.json')
    const china = readMeta('public/demo/china/wind/meta.json')
    assert.throws(() => assertGlobalPack('regional/temp', regional), /禁止绑定区域包/)
    assert.throws(() => assertGlobalPack('china/wind', china), /禁止绑定区域包/)
    assert.throws(() => assertGlobalPack('global/temp', regional), /禁止绑定区域包/)
  })
})
