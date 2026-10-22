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
  | 'forecast/china'
  | 'regional/currents'
  | 'regional/temp'
  | 'regional/precip'

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

export const PAGE_PACK: Record<'global' | 'desk' | 'regional', DemoPackId> = {
  global: 'global/wind',
  desk: 'forecast/china',
  regional: 'regional/currents',
}

export const PAGE_DEFAULT_KIND: Record<'global' | 'desk' | 'regional', FieldKind> = {
  global: 'wind',
  desk: 'wind',
  regional: 'ocean',
}

/** 三页共用四要素包。区域无独立风包时回退预报台全国风。 */
export function packForKind(page: 'global' | 'desk' | 'regional', kind: FieldKind): DemoPackId {
  if (kind === 'wind') return page === 'global' ? 'global/wind' : 'forecast/china'
  if (kind === 'ocean') return 'regional/currents'
  if (kind === 'temp') return 'regional/temp'
  return 'regional/precip'
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
