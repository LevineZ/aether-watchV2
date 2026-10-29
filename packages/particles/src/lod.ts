/** 屏上风粒子锁 20,000–30,000。GPU 纹理可更大，draw 只取前 N。 */

export const LOD = {
  peak: 30_000,
  cruise: 24_000,
  interact: 8_000,
  paused: 0,
} as const

export type LodLevel = keyof typeof LOD

export const PARTICLE_TEX = { width: 800, height: 500 }

export const WIND_COUNT_MIN = 20_000
export const WIND_COUNT_MAX = 30_000

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

/** 粒子只给 wind / ocean。precip 必须是 0。ocean ≈ 18% wind。风锁 2–3 万。 */
export function visualCount(opts: {
  ocean: boolean
  precip?: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  if (opts.precip) return 0
  const wind = windCount(opts)
  if (opts.ocean) return Math.max(180, Math.floor(wind * 0.18))
  return wind
}
