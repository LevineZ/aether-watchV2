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

/** 默认观感：全球远景细丝 ~28–38k / 预报台更稀 / 洋流冻结不变。密度滑条 0.2–1。 */
export function visualCount(opts: { ocean: boolean; regionalWindow: boolean; density: number }): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  if (opts.ocean) return Math.floor((opts.regionalWindow ? 14_000 : 36_000) * d)
  return Math.floor((opts.regionalWindow ? 18_000 : 72_000) * d)
}
