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

/** n∝1/zoom²：远景更密、近景更稀。密度滑条 0.2–1。气温/降雨走 count=0，不走这里。 */
export function zoomCountMul(zoom: number): number {
  const z = Math.max(0.85, zoom)
  return Math.max(0.14, Math.min(1.25, (ZOOM_REF / z) ** 2))
}

/** 默认观感：全球远景细丝 ~28–38k / 预报台更稀 / 洋流冻结不变。 */
export function visualCount(opts: {
  ocean: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  const zMul = zoomCountMul(opts.zoom ?? ZOOM_REF)
  if (opts.ocean) return Math.floor((opts.regionalWindow ? 14_000 : 36_000) * d * zMul)
  return Math.floor((opts.regionalWindow ? 18_000 : 72_000) * d * zMul)
}
