import { loadDemo } from './demo'
import { applyMaskContract } from './mask'
import {
  assertGlobalPack,
  inferKind,
  isGlobalDemoPack,
  type DemoPackId,
  type FieldFrame,
  type PackMetaJson,
} from './types'

const OCEAN_PACKS = new Set(['global/ocean', 'regional/currents'])

async function fetchBuf(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`读取失败 ${url} (${res.status})`)
  return res.arrayBuffer()
}

function asF32(buf: ArrayBuffer, expect: number, label: string): Float32Array {
  if (buf.byteLength !== expect * 4) {
    throw new Error(`${label} 字节数 ${buf.byteLength}，期望 ${expect * 4}`)
  }
  return new Float32Array(buf.slice(0))
}

function asU8(buf: ArrayBuffer, expect: number, label: string): Uint8Array {
  if (buf.byteLength !== expect) {
    throw new Error(`${label} 字节数 ${buf.byteLength}，期望 ${expect}`)
  }
  return new Uint8Array(buf.slice(0))
}

/** 读服务端 6h 落盘缓存 `/api/fields/{packId}` → FieldFrame。 */
export async function loadLivePack(packId: string): Promise<FieldFrame> {
  const base = `/api/fields/${packId}`
  const metaRes = await fetch(`${base}/meta.json`)
  if (!metaRes.ok) {
    throw new Error(`live pack ${packId} unavailable (${metaRes.status})`)
  }
  const pack = (await metaRes.json()) as PackMetaJson
  if ((pack as { error?: string }).error) {
    throw new Error(`live pack ${packId}: ${(pack as { error: string }).error}`)
  }
  const n = pack.nx * pack.ny
  if (!n) throw new Error(`${packId} 网格尺寸无效`)
  if (isGlobalDemoPack(packId)) assertGlobalPack(packId, pack)

  const kindHint = pack.kind ?? inferKind({ meta: pack.meta, packId })
  const wantMask = kindHint === 'ocean' && !!pack.maskFile
  const [uBuf, vBuf, scalarBuf, maskBuf] = await Promise.all([
    fetchBuf(`${base}/${pack.uFile || 'u.bin'}`),
    fetchBuf(`${base}/${pack.vFile || 'v.bin'}`),
    pack.scalarFile ? fetchBuf(`${base}/${pack.scalarFile}`).catch(() => null) : Promise.resolve(null),
    wantMask ? fetchBuf(`${base}/${pack.maskFile as string}`).catch(() => null) : Promise.resolve(null),
  ])

  const frame: FieldFrame = {
    nx: pack.nx,
    ny: pack.ny,
    bbox: pack.bbox,
    time: pack.time,
    u: asF32(uBuf, n, 'u.bin'),
    v: asF32(vBuf, n, 'v.bin'),
    kind: kindHint,
    meta: {
      source: pack.meta?.source === 'live' ? 'live' : 'live',
      vars: pack.meta?.vars ?? ['uo', 'vo'],
      units: pack.meta?.units ?? 'm/s',
      fill: pack.meta?.fill,
      note: pack.meta?.note,
    },
  }
  if (scalarBuf) frame.scalar = asF32(scalarBuf, n, 'scalar.bin')
  if (frame.kind === 'ocean' && maskBuf) frame.mask = asU8(maskBuf, n, 'mask.bin')
  const out = applyMaskContract(frame)
  if (isGlobalDemoPack(packId)) assertGlobalPack(packId, out)
  return out
}

/**
 * 真源入口：签名与 loadDemo 相同。
 * - ocean：优先 `/api/fields` 落盘缓存（OSCAR，TTL≈6h）；无钥匙/失败 → demo
 * - wind/temp/precip：OM 后置，现仍 demo（架构已留钩子）
 */
export async function loadLive(packId: DemoPackId | string): Promise<FieldFrame> {
  if (OCEAN_PACKS.has(String(packId))) {
    try {
      return await loadLivePack(String(packId))
    } catch (e) {
      console.warn('[aether] loadLive ocean → demo', packId, e instanceof Error ? e.message : e)
    }
  }

  // OM plug point: later call /api/fields for wind|temp|precip packs.
  const frame = await loadDemo(packId)
  return {
    nx: frame.nx,
    ny: frame.ny,
    bbox: frame.bbox,
    time: frame.time,
    u: frame.u,
    v: frame.v,
    scalar: frame.scalar,
    mask: frame.mask,
    kind: frame.kind,
    meta: {
      source: 'demo',
      vars: frame.meta.vars,
      units: frame.meta.units,
      fill: frame.meta.fill,
      note: OCEAN_PACKS.has(String(packId))
        ? 'ocean live unavailable; demo fallback'
        : 'OM live not wired; demo',
    },
  }
}
