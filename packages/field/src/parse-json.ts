import { NcUploadError, type BBox, type FieldFrame, type FieldKind, type FieldSource } from './types.ts'

type WireMeta = {
  nx?: number
  ny?: number
  lon0?: number
  lat0?: number
  dlon?: number
  dlat?: number
  lat_order?: 'ascending' | 'descending'
  lon_order?: 'ascending' | 'descending' | '0-360'
  kind?: FieldKind
  unit?: string
  units?: string
  time?: string
  level?: number | string | null
  source?: string
  vars?: string[]
  fill?: number
}

type WireFrame = {
  nx?: number
  ny?: number
  bbox?: BBox
  time?: string
  kind?: FieldKind
  u?: ArrayLike<number | null>
  v?: ArrayLike<number | null>
  data?: ArrayLike<number | null>
  scalar?: ArrayLike<number | null>
  mask?: ArrayLike<number | null>
  vmin?: number
  vmax?: number
  meta?: WireMeta
}

const KINDS = new Set<FieldKind>(['wind', 'temp', 'precip', 'ocean'])

function asKind(v: unknown): FieldKind | undefined {
  return typeof v === 'string' && KINDS.has(v as FieldKind) ? (v as FieldKind) : undefined
}

function toF32(src: ArrayLike<number | null> | undefined, n: number, fill = Number.NaN): Float32Array {
  const out = new Float32Array(n)
  if (!src) {
    out.fill(0)
    return out
  }
  if (src.length !== n) {
    throw new NcUploadError('PARSE_FAILED', `数组长度 ${src.length} 与网格 ${n} 不一致`)
  }
  for (let i = 0; i < n; i++) {
    const v = src[i]
    out[i] = v == null || (typeof v === 'number' && !Number.isFinite(v)) ? fill : Number(v)
  }
  return out
}

function toMask(src: ArrayLike<number | null> | undefined, n: number): Uint8Array | undefined {
  if (!src) return undefined
  if (src.length !== n) throw new NcUploadError('PARSE_FAILED', `mask 长度 ${src.length} 与网格 ${n} 不一致`)
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const v = src[i]
    out[i] = v && Number(v) > 0 ? 1 : 0
  }
  return out
}

function flipRows<T extends Float32Array | Uint8Array>(arr: T, nx: number, ny: number): T {
  const row = nx
  const tmp = new (arr.constructor as { new (n: number): T })(row)
  for (let y = 0; y < Math.floor(ny / 2); y++) {
    const a = y * row
    const b = (ny - 1 - y) * row
    tmp.set(arr.subarray(a, a + row) as unknown as ArrayLike<number>)
    arr.set(arr.subarray(b, b + row) as unknown as ArrayLike<number>, a)
    arr.set(tmp as unknown as ArrayLike<number>, b)
  }
  return arr
}

function rollLon<T extends Float32Array | Uint8Array>(arr: T, nx: number, ny: number, pivot: number): T {
  if (pivot <= 0 || pivot >= nx) return arr
  const row = new (arr.constructor as { new (n: number): T })(nx)
  for (let y = 0; y < ny; y++) {
    const o = y * nx
    row.set(arr.subarray(o + pivot, o + nx) as unknown as ArrayLike<number>, 0)
    row.set(arr.subarray(o, o + pivot) as unknown as ArrayLike<number>, nx - pivot)
    arr.set(row as unknown as ArrayLike<number>, o)
  }
  return arr
}

function sourceOf(raw: string | undefined): FieldSource {
  if (raw === 'live') return 'live'
  if (raw === 'open-data') return 'open-data'
  if (raw === 'demo') return 'demo'
  return 'upload'
}

/**
 * 把 spec 线格式或现有 FieldFrame JSON 收敛成内部 FieldFrame。
 * lat 升序、lon −180–180；缺失值 → NaN。
 */
export function parseFieldFrameJson(raw: unknown): FieldFrame {
  if (!raw || typeof raw !== 'object') {
    throw new NcUploadError('BAD_FORMAT', '格式不支持')
  }
  const w = raw as WireFrame
  const m = w.meta ?? {}
  const nx = Number(m.nx ?? w.nx)
  const ny = Number(m.ny ?? w.ny)
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || nx < 2 || ny < 1) {
    throw new NcUploadError('MISSING_VARS', '无地理维')
  }
  const n = nx * ny
  const hasUv = !!(w.u && w.v)
  const hasData = !!(w.data || w.scalar)
  if (!hasUv && !hasData) {
    throw new NcUploadError('MISSING_VARS', '无地理维')
  }

  let lon0 = Number(m.lon0)
  let lat0 = Number(m.lat0)
  let dlon = Number(m.dlon)
  let dlat = Number(m.dlat)
  let bbox: BBox | null = Array.isArray(w.bbox) && w.bbox.length === 4 ? [...w.bbox] as BBox : null

  if (!Number.isFinite(lon0) || !Number.isFinite(lat0) || !Number.isFinite(dlon) || !Number.isFinite(dlat)) {
    if (bbox) {
      lon0 = bbox[0]
      lat0 = bbox[1]
      dlon = (bbox[2] - bbox[0]) / Math.max(1, nx - 1)
      dlat = (bbox[3] - bbox[1]) / Math.max(1, ny - 1)
    } else {
      throw new NcUploadError('MISSING_VARS', '无地理维')
    }
  }

  const kind = asKind(m.kind) ?? asKind(w.kind) ?? (hasData && !hasUv ? 'temp' : 'wind')
  const u = toF32(w.u, n, kind === 'wind' || kind === 'ocean' ? Number.NaN : 0)
  const v = toF32(w.v, n, kind === 'wind' || kind === 'ocean' ? Number.NaN : 0)
  const scalarSrc = w.data ?? w.scalar
  const scalar = hasData || kind === 'temp' || kind === 'precip' ? toF32(scalarSrc, n, Number.NaN) : undefined
  const mask = kind === 'ocean' ? toMask(w.mask, n) : undefined

  let latOrder: 'ascending' | 'descending' = m.lat_order === 'descending' || dlat < 0 ? 'descending' : 'ascending'
  let lonOrder: 'ascending' | '0-360' = m.lon_order === '0-360' ? '0-360' : 'ascending'

  if (latOrder === 'descending') {
    flipRows(u, nx, ny)
    flipRows(v, nx, ny)
    if (scalar) flipRows(scalar, nx, ny)
    if (mask) flipRows(mask, nx, ny)
    lat0 = lat0 + dlat * (ny - 1)
    dlat = Math.abs(dlat)
    latOrder = 'ascending'
  }

  const lonLast = lon0 + dlon * (nx - 1)
  if (lon0 >= -1e-6 && lonLast > 180 + 1e-6) {
    const pivot = Math.round((180 - lon0) / Math.max(1e-9, dlon))
    const p = Math.max(0, Math.min(nx, pivot))
    rollLon(u, nx, ny, p)
    rollLon(v, nx, ny, p)
    if (scalar) rollLon(scalar, nx, ny, p)
    if (mask) rollLon(mask, nx, ny, p)
    lon0 = lon0 + dlon * p - 360
    lonOrder = 'ascending'
  } else if (lon0 > 180) {
    lon0 -= 360
  }

  const west = lon0
  const south = lat0
  const east = lon0 + dlon * (nx - 1)
  const north = lat0 + dlat * (ny - 1)
  bbox = [west, south, east, north]

  const vmin = Number.isFinite(w.vmin) ? Number(w.vmin) : undefined
  const vmax = Number.isFinite(w.vmax) ? Number(w.vmax) : undefined

  return {
    nx,
    ny,
    bbox,
    time: typeof m.time === 'string' ? m.time : w.time,
    u,
    v,
    scalar,
    mask,
    kind,
    vmin,
    vmax,
    meta: {
      source: sourceOf(m.source),
      vars: Array.isArray(m.vars) ? m.vars : hasUv ? ['u', 'v'] : ['data'],
      units: m.unit ?? m.units ?? (kind === 'temp' ? '°C' : kind === 'precip' ? 'mm' : 'm/s'),
      fill: m.fill,
      lat_order: latOrder,
      lon_order: lonOrder,
      level: m.level ?? null,
      vmin,
      vmax,
    },
  }
}
