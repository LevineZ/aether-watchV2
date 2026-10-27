/** FieldFrame 是全仓唯一场交换形状。禁止前端直读各源私有 JSON。 */

export type FieldSource = 'demo' | 'live' | 'upload'

export type BBox = [west: number, south: number, east: number, north: number]

/** 四种场：样式由 kind 决定，禁止一套青点换标签。 */
export type FieldKind = 'wind' | 'ocean' | 'temp' | 'precip'

export type FieldFrame = {
  nx: number
  ny: number
  bbox: BBox
  time?: string
  /** length nx*ny, row-major, south → north */
  u: Float32Array
  v: Float32Array
  scalar?: Float32Array
  /** 1=ocean/valid, 0=land/invalid */
  mask?: Uint8Array
  kind?: FieldKind
  meta: {
    source: FieldSource
    vars: string[]
    units: string
    fill?: number
  }
}

export type DemoPackId =
  | 'global/wind'
  | 'global/ocean'
  | 'global/temp'
  | 'global/precip'
  | 'china/wind'
  | 'china/temp'
  | 'china/precip'
  | 'forecast/china'
  | 'regional/currents'
  | 'regional/temp'
  | 'regional/precip'

export type PageId = 'global' | 'desk' | 'regional'

export type PackMetaJson = {
  nx: number
  ny: number
  bbox: BBox
  time?: string
  kind?: FieldKind
  uFile?: string
  vFile?: string
  scalarFile?: string | null
  maskFile?: string | null
  meta: FieldFrame['meta']
}

export type NcErrorCode =
  | 'TOO_LARGE'
  | 'BAD_EXT'
  | 'NC4_UNSUPPORTED'
  | 'BAD_FORMAT'
  | 'MISSING_VARS'
  | 'NO_OVERLAP'
  | 'PARSE_FAILED'

export class NcUploadError extends Error {
  code: NcErrorCode
  constructor(code: NcErrorCode, message: string) {
    super(message)
    this.name = 'NcUploadError'
    this.code = code
  }
}

export const MAX_NC_BYTES = 100 * 1024 * 1024

export const PAGE_PACK: Record<PageId, DemoPackId> = {
  global: 'global/wind',
  desk: 'china/wind',
  regional: 'regional/currents',
}

export const PAGE_DEFAULT_KIND: Record<PageId, FieldKind> = {
  global: 'wind',
  desk: 'wind',
  regional: 'ocean',
}

/**
 * 页 × 要素 → DEMO 包。缺包返回 null（灰芯片 / 404），禁止跨页回退。
 * Global 只绑 global/* 全球窗；Desk 只用 china/*；Desk 洋流无近岸包。
 */
export const PAGE_KIND_PACK: Record<PageId, Record<FieldKind, DemoPackId | null>> = {
  global: {
    wind: 'global/wind',
    ocean: 'global/ocean',
    temp: 'global/temp',
    precip: 'global/precip',
  },
  desk: {
    wind: 'china/wind',
    ocean: null,
    temp: 'china/temp',
    precip: 'china/precip',
  },
  regional: {
    wind: 'china/wind',
    ocean: 'regional/currents',
    temp: 'regional/temp',
    precip: 'regional/precip',
  },
}

/** 仅 `global/*` 可绑全球 Tab。china / regional / forecast 一律不算全球包。 */
export function isGlobalDemoPack(packId: string): boolean {
  return packId.startsWith('global/')
}

/**
 * 全球 Tab 缺包或误配时返回 null（灰芯片），禁止把 regional/*、china/* 交出去。
 */
export function packForKind(page: PageId, kind: FieldKind): DemoPackId | null {
  const pack = PAGE_KIND_PACK[page][kind]
  if (!pack) return null
  if (page === 'global' && !isGlobalDemoPack(pack)) return null
  return pack
}

/** Global 禁止区域 141×131 / regional/* / china/* / 东海窗。 */
export function isRegionalStamp(packId: string, frame?: Pick<FieldFrame, 'nx' | 'ny' | 'bbox'>): boolean {
  const id = packId.toLowerCase()
  if (id.includes('regional') || id.includes('china') || id.startsWith('forecast/')) return true
  if (!frame) return false
  if (frame.nx === 141 || frame.ny === 131) return true
  const [w, s, e, n] = frame.bbox
  const lonSpan = e - w
  const latSpan = n - s
  const eastChina =
    lonSpan < 30 && latSpan < 25 && w > 110 && e < 140 && s > 15 && n < 45
  return eastChina
}

export function assertGlobalPack(packId: string, frame: Pick<FieldFrame, 'nx' | 'ny' | 'bbox'>): void {
  if (!isGlobalDemoPack(packId) || isRegionalStamp(packId, frame)) {
    throw new Error(`Global 禁止绑定区域包 ${packId}（${frame.nx}×${frame.ny}）`)
  }
  const lonSpan = frame.bbox[2] - frame.bbox[0]
  const latSpan = frame.bbox[3] - frame.bbox[1]
  if (lonSpan < 300 || latSpan < 140 || frame.nx * frame.ny < 200_000) {
    throw new Error(
      `Global 包须为全球窗 ~721×361，收到 ${packId} ${frame.nx}×${frame.ny} span=${lonSpan}×${latSpan}`,
    )
  }
}

const PRECIP_VARS = new Set(['tp', 'precip', 'rain', 'precipitation', 'pr'])
const TEMP_VARS = new Set(['t', 'temp', 't2m', 'temperature', 'sst', 'thetao'])
const OCEAN_VARS = new Set(['uo', 'vo', 'water_u', 'water_v'])

/** 从 vars / pack id 推断 kind。显式 frame.kind 优先。 */
export function inferKind(frame: Pick<FieldFrame, 'kind' | 'meta' | 'scalar'> & { packId?: string }): FieldKind {
  if (frame.kind) return frame.kind
  const pack = frame.packId ?? ''
  if (pack.includes('precip')) return 'precip'
  if (pack.includes('temp')) return 'temp'
  if (pack.includes('currents') || pack.includes('ocean')) return 'ocean'
  if (pack.includes('wind') || pack.includes('forecast') || pack.includes('china')) return 'wind'
  const vars = (frame.meta?.vars ?? []).map((v) => v.toLowerCase())
  if (vars.some((v) => PRECIP_VARS.has(v))) return 'precip'
  if (vars.some((v) => TEMP_VARS.has(v))) return 'temp'
  if (vars.some((v) => OCEAN_VARS.has(v))) return 'ocean'
  if (frame.scalar && !vars.some((v) => v === 'u' || v === 'v')) return 'temp'
  return 'wind'
}
