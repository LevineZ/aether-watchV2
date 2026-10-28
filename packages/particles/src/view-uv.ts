/** Map camera → FieldFrame UV window. Particles spawn here so zoomed views stay dense. */

export type LonLatView = {
  west: number
  south: number
  east: number
  north: number
}

export type BBox4 = [west: number, south: number, east: number, north: number]

/**
 * Visible field UV (plus pad) for the current camera.
 * Global packs stay [-180,-90,180,90]; the camera is only a window — never letterbox the curtain.
 */
export function fieldViewUv(view: LonLatView, bbox: BBox4, pad = 0.16): BBox4 {
  const [lon0, lat0, lon1, lat1] = bbox
  const lonSpan = lon1 - lon0 || 1
  const latSpan = lat1 - lat0 || 1
  let u0 = (view.west - lon0) / lonSpan
  let u1 = (view.east - lon0) / lonSpan
  let v0 = (view.south - lat0) / latSpan
  let v1 = (view.north - lat0) / latSpan
  if (u1 < u0) {
    u0 = 0
    u1 = 1
  }
  const pu = Math.max(0.01, (u1 - u0) * pad)
  const pv = Math.max(0.01, (v1 - v0) * pad)
  u0 -= pu
  u1 += pu
  v0 -= pv
  v1 += pv
  const wrap = lonSpan > 350
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  v0 = clamp01(v0)
  v1 = clamp01(v1)
  if (wrap) {
    if (u1 - u0 >= 0.92) {
      u0 = 0
      u1 = 1
    } else {
      u0 = clamp01(u0)
      u1 = clamp01(u1)
    }
  } else {
    u0 = clamp01(u0)
    u1 = clamp01(u1)
  }
  if (u1 - u0 < 0.02) {
    u0 = clamp01(u0 - 0.01)
    u1 = clamp01(u0 + 0.02)
  }
  if (v1 - v0 < 0.02) {
    v0 = clamp01(v0 - 0.01)
    v1 = clamp01(v0 + 0.02)
  }
  return [u0, v0, u1, v1]
}
