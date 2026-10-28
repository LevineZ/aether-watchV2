/** GPU 驻留 peak≈40 万；观感计数远低于此。LOD 数字高 ≠ 好看。 */

export const LOD = {
  peak: 400_000,
  cruise: 160_000,
  interact: 8_000,
  paused: 0,
} as const

export type LodLevel = keyof typeof LOD

export const PARTICLE_TEX = { width: 800, height: 500 } // 400_000 resident

export function lodCount(level: LodLevel): number {
  return LOD[level]
}

const ZOOM_REF = 1.35

/** n∝1/zoom²：仅 wind。temp/precip count=0；ocean 约为 wind 的 30%。 */
export function zoomCountMul(zoom: number): number {
  const z = Math.max(0.85, zoom)
  return Math.max(0.08, Math.min(1.35, (ZOOM_REF / z) ** 2))
}

function windCount(opts: { regionalWindow: boolean; density: number; zoom?: number }): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  return Math.floor((opts.regionalWindow ? 6_000 : 15_000) * d * zoomCountMul(opts.zoom ?? ZOOM_REF))
}

/** 粒子只给 wind / ocean。precip 必须是 0。ocean ≈ 30% wind。 */
export function visualCount(opts: {
  ocean: boolean
  precip?: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  if (opts.precip) return 0
  const wind = windCount(opts)
  if (opts.ocean) return Math.max(320, Math.floor(wind * 0.3))
  return wind
}
