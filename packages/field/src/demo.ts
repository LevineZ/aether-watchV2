import { applyMaskContract } from './mask'
import { inferKind, type DemoPackId, type FieldFrame, type PackMetaJson } from './types'

export const DEMO_PACK_BASE: Record<DemoPackId, string> = {
  'global/wind': '/demo/global/wind',
  'forecast/china': '/demo/forecast/china',
  'regional/currents': '/demo/regional/currents',
  'regional/temp': '/demo/regional/temp',
  'regional/precip': '/demo/regional/precip',
}

async function fetchBuf(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`读取失败 ${url} (${res.status})`)
  return res.arrayBuffer()
}

function asF32(buf: ArrayBuffer, expect: number, label: string): Float32Array {
  if (buf.byteLength !== expect * 4) {
    throw new Error(`${label} 字节数 ${buf.byteLength}，期望 ${expect * 4}（Float32 LE）`)
  }
  return new Float32Array(buf.slice(0))
}

function asU8(buf: ArrayBuffer, expect: number, label: string): Uint8Array {
  if (buf.byteLength !== expect) {
    throw new Error(`${label} 字节数 ${buf.byteLength}，期望 ${expect}`)
  }
  return new Uint8Array(buf.slice(0))
}

/** 读 public/demo/** 静态包，产出 FieldFrame。 */
export async function loadDemo(packId: DemoPackId | string): Promise<FieldFrame> {
  const base = DEMO_PACK_BASE[packId as DemoPackId]
  if (!base) throw new Error(`未知 demo 包: ${packId}`)

  const metaRes = await fetch(`${base}/meta.json`)
  if (!metaRes.ok) throw new Error(`读取 ${packId} meta.json 失败`)
  const pack = (await metaRes.json()) as PackMetaJson
  const n = pack.nx * pack.ny
  if (!n) throw new Error(`${packId} 网格尺寸无效`)

  const kindHint = pack.kind ?? inferKind({ meta: pack.meta ?? { source: 'demo', vars: [], units: '' }, packId })
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
    meta: {
      source: 'demo',
      vars: pack.meta?.vars ?? ['u', 'v'],
      units: pack.meta?.units ?? 'm/s',
      fill: pack.meta?.fill,
    },
  }
  if (scalarBuf) frame.scalar = asF32(scalarBuf, n, 'scalar.bin')
  frame.kind = pack.kind ?? inferKind({ ...frame, packId })
  if (frame.kind === 'ocean' && maskBuf) frame.mask = asU8(maskBuf, n, 'mask.bin')
  return applyMaskContract(frame)
}
