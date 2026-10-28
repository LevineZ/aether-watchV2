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

/** n∝1/zoom^0.85：远景更密、近景仍够丝。气温走 count=0；降雨另计。 */
export function zoomCountMul(zoom: number): number {
  const z = Math.max(0.85, zoom)
  return Math.max(0.28, Math.min(1.25, (ZOOM_REF / z) ** 0.85))
}

/** Ventusky/Windy：屏空间拖影，粒子宜稀。过密会糊成噪点、盖住地图。 */
export function visualCount(opts: {
  ocean: boolean
  precip?: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  if (opts.ocean) return Math.floor((opts.regionalWindow ? 6_000 : 12_000) * d)
  if (opts.precip) return Math.floor((opts.regionalWindow ? 8_000 : 12_000) * d)
  const zMul = zoomCountMul(opts.zoom ?? ZOOM_REF)
  return Math.floor((opts.regionalWindow ? 6_000 : 15_000) * d * zMul)
}
