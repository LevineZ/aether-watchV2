/** GPU 驻留 peak≈40 万。观感 n ≈ baseN / zoom²（Ventusky 规格）。 */

export const LOD = {
  peak: 400_000,
  cruise: 160_000,
  interact: 8_000,
  paused: 0,
} as const

export type LodLevel = keyof typeof LOD

export const PARTICLE_TEX = { width: 800, height: 500 } // 400_000 resident
export const PARTICLE_BASE = 360_000
const ZOOM_REF = 1.35

export function lodCount(level: LodLevel): number {
  return LOD[level]
}

/** n ∝ 1/zoom²。远景密、近景稀。 */
export function zoomCountMul(zoom: number): number {
  const z = Math.max(0.85, zoom)
  return 1 / (z * z)
}

export function visualCount(opts: {
  ocean: boolean
  precip?: boolean
  regionalWindow: boolean
  density: number
  zoom?: number
}): number {
  const d = Math.max(0.2, Math.min(1, opts.density))
  const zMul = zoomCountMul(opts.zoom ?? ZOOM_REF)
  let base = PARTICLE_BASE
  if (opts.ocean) base *= 0.28
  if (opts.precip) base *= 0.22
  const n = Math.floor(base * d * zMul)
  return Math.max(2_000, Math.min(PARTICLE_TEX.width * PARTICLE_TEX.height, n))
}
