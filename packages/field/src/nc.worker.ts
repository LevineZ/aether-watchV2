/// <reference lib="webworker" />
import { NetCDFReader } from 'netcdfjs'
import type { BBox, FieldFrame } from './types'
import { clipToBbox } from './clip'

const U_NAMES = ['u', 'ugrd', 'uo', 'water_u', 'eastward_wind', 'eastward_sea_water_velocity']
const V_NAMES = ['v', 'vgrd', 'vo', 'water_v', 'northward_wind', 'northward_sea_water_velocity']
const T_NAMES = ['t', 'temp', 't2m', 'temperature', 'sst', 'thetao']
const P_NAMES = ['tp', 'precip', 'rain', 'precipitation', 'pr']
const LON_NAMES = ['lon', 'longitude', 'x', 'nav_lon']
const LAT_NAMES = ['lat', 'latitude', 'y', 'nav_lat']

type Incoming = {
  buffer: ArrayBuffer
  filename: string
  bbox: BBox
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code })
}

function magicKind(buf: ArrayBuffer): 'nc3' | 'nc4' | 'unknown' {
  const b = new Uint8Array(buf)
  if (b.length >= 3 && b[0] === 0x43 && b[1] === 0x44 && b[2] === 0x46) return 'nc3'
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x48 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'nc4'
  }
  return 'unknown'
}

function pickVar(names: string[], candidates: string[]): string | undefined {
  const lower = names.map((n) => n.toLowerCase())
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase())
    if (i >= 0) return names[i]
  }
  return undefined
}

function toFloat32(data: unknown): Float32Array {
  if (data instanceof Float32Array) return data
  if (data instanceof Float64Array) return Float32Array.from(data)
  if (data instanceof Int16Array || data instanceof Int32Array || data instanceof Uint8Array) {
    return Float32Array.from(data)
  }
  if (Array.isArray(data)) return Float32Array.from(data as number[])
  fail('PARSE_FAILED', '变量数据类型无法转为 Float32')
}

function axis1d(reader: NetCDFReader, name: string | undefined, fallback: number, start: number, end: number): Float32Array {
  if (name) {
    try {
      const raw = toFloat32(reader.getDataVariable(name))
      if (raw.length >= 2) return raw
    } catch {
      /* fall through */
    }
  }
  const out = new Float32Array(fallback)
  for (let i = 0; i < fallback; i++) out[i] = fallback === 1 ? (start + end) / 2 : start + (i / (fallback - 1)) * (end - start)
  return out
}

function findDimSize(reader: NetCDFReader, names: string[]): number | undefined {
  const dims = reader.dimensions as { name: string; size: number }[]
  for (const n of names) {
    const d = dims.find((x) => x.name.toLowerCase() === n)
    if (d) return d.size
  }
  return undefined
}

self.onmessage = (ev: MessageEvent<Incoming>) => {
  try {
    const { buffer, filename, bbox } = ev.data
    const kind = magicKind(buffer)
    if (kind === 'nc4') {
      fail(
        'NC4_UNSUPPORTED',
        '检测到 NetCDF-4 / HDF5。当前 Worker 解码 NetCDF-3（CDF）。请用 nccopy 转 classic 或改用示例包。',
      )
    }
    if (kind === 'unknown') {
      fail('BAD_FORMAT', `无法识别 ${filename || '文件'} 头魔数，需要 NetCDF-3（CDF\\x01/\\x02）。`)
    }

    const reader = new NetCDFReader(buffer)
    const varNames = (reader.variables as { name: string }[]).map((v) => v.name)
    const uName = pickVar(varNames, U_NAMES)
    const vName = pickVar(varNames, V_NAMES)
    const tName = pickVar(varNames, T_NAMES)
    const pName = pickVar(varNames, P_NAMES)
    const lonName = pickVar(varNames, LON_NAMES)
    const latName = pickVar(varNames, LAT_NAMES)

    if (!uName && !vName && !tName && !pName) {
      fail('MISSING_VARS', `未找到 u|ugrd|uo / v|vgrd|vo 或 t|temp|t2m / tp|precip|rain。现有变量：${varNames.join(', ') || '无'}`)
    }

    const nxGuess = findDimSize(reader, ['lon', 'longitude', 'x']) ?? 0
    const nyGuess = findDimSize(reader, ['lat', 'latitude', 'y']) ?? 0

    let u: Float32Array | undefined
    let v: Float32Array | undefined
    let scalar: Float32Array | undefined
    let nx = nxGuess
    let ny = nyGuess

    if (uName && vName) {
      u = toFloat32(reader.getDataVariable(uName))
      v = toFloat32(reader.getDataVariable(vName))
    }
    if (tName) scalar = toFloat32(reader.getDataVariable(tName))
    else if (pName) scalar = toFloat32(reader.getDataVariable(pName))

    if (!nx || !ny) {
      const n = (u || v || scalar)?.length ?? 0
      if (nx && n) ny = Math.round(n / nx)
      else if (ny && n) nx = Math.round(n / ny)
      else {
        ny = Math.max(2, Math.round(Math.sqrt(n / 2)))
        nx = Math.max(2, Math.round(n / ny))
      }
    }

    const n = nx * ny
    if (!n || (u && u.length < n) || (v && v.length < n)) {
      fail('PARSE_FAILED', `网格尺寸无法对齐（nx=${nx} ny=${ny} n=${u?.length ?? v?.length ?? 0}）`)
    }

    const lon = axis1d(reader, lonName, nx, bbox[0], bbox[2])
    const lat = axis1d(reader, latName, ny, bbox[1], bbox[3])
    const lon0 = lon[0]
    const lon1 = lon[lon.length - 1]
    const lat0 = lat[0]
    const lat1 = lat[lat.length - 1]
    const south = Math.min(lat0, lat1)
    const north = Math.max(lat0, lat1)
    const west = Math.min(lon0, lon1)
    const east = Math.max(lon0, lon1)

    const needFlipY = lat0 > lat1
    const uu = new Float32Array(n)
    const vv = new Float32Array(n)
    const ss = scalar ? new Float32Array(n) : undefined
    for (let iy = 0; iy < ny; iy++) {
      const srcY = needFlipY ? ny - 1 - iy : iy
      for (let ix = 0; ix < nx; ix++) {
        const si = srcY * nx + ix
        const di = iy * nx + ix
        uu[di] = u ? u[si] : 0
        vv[di] = v ? v[si] : 0
        if (ss && scalar) ss[di] = scalar[si]
      }
    }

    const vars = [uName, vName, tName, pName].filter(Boolean) as string[]
    const raw: FieldFrame = {
      nx,
      ny,
      bbox: [west, south, east, north],
      u: uu,
      v: vv,
      scalar: ss,
      kind: pName ? 'precip' : tName ? 'temp' : uName ? 'ocean' : 'wind',
      meta: {
        source: 'upload',
        vars,
        units: uName ? 'm/s' : tName ? 'K' : 'mm',
      },
    }

    const clipped = clipToBbox(raw, bbox)
    const transfer: Transferable[] = [clipped.u.buffer, clipped.v.buffer]
    if (clipped.scalar) transfer.push(clipped.scalar.buffer)
    if (clipped.mask) transfer.push(clipped.mask.buffer)

    ;(self as DedicatedWorkerGlobalScope).postMessage({ ok: true, frame: clipped }, transfer)
  } catch (err) {
    const e = err as Error & { code?: string }
    ;(self as DedicatedWorkerGlobalScope).postMessage({
      ok: false,
      code: e.code || 'PARSE_FAILED',
      message: e.message || '解析失败',
    })
  }
}
