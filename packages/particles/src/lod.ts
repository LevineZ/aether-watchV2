/** 屏上风粒子约 8,000–14,000（降密恐）；GPU 纹理可更大，draw 只取前 N。 */

export const LOD = {
  peak: 14_000,
  cruise: 11_000,
  interact: 5_000,
  paused: 0,
} as const

export type LodLevel = keyof typeof LOD

export const PARTICLE_TEX = { width: 800, height: 500 }

export const WIND_COUNT_MIN = 8_000
export const WIND_COUNT_MAX = 14_000

export function lodCount(level: LodLevel): number {
  return LOD[level]
}

const ZOOM_REF = 1.35

/** n∝1/zoom² helper；风粒子屏上数不再跟 zoom 砍到 2 万以下。 */
export function zoomCountMul(zoom: number): number {
  const z = Math.max(0.85, zoom)
  return Math.max(0.08, Math.min(1.35, (ZOOM_REF / z) ** 2))
}

function windCount(opts: { regionalWindow: boolean; density: number; zoom?: number }): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  const t = (d - 0.2) / 0.8
  return Math.round(WIND_COUNT_MIN + (WIND_COUNT_MAX - WIND_COUNT_MIN) * t)
}

/** 粒子只给 wind / ocean。precip 必须是 0。ocean ≈ 85% wind。 */
export function visualCount(opts: {
  ocean: boolean
  precip?: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  if (opts.precip) return 0
  const wind = windCount(opts)
  if (opts.ocean) return Math.max(160, Math.floor(wind * 0.85))
  return wind
}
