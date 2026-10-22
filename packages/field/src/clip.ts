import type { BBox, FieldFrame } from './types'

function lonLatAt(frame: FieldFrame, ix: number, iy: number): [number, number] {
  const [w, s, e, n] = frame.bbox
  const lon = frame.nx === 1 ? (w + e) / 2 : w + (ix / (frame.nx - 1)) * (e - w)
  const lat = frame.ny === 1 ? (s + n) / 2 : s + (iy / (frame.ny - 1)) * (n - s)
  return [lon, lat]
}

function sampleBilinear(arr: Float32Array, nx: number, ny: number, x: number, y: number): number {
  const fx = Math.max(0, Math.min(nx - 1, x))
  const fy = Math.max(0, Math.min(ny - 1, y))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(nx - 1, x0 + 1)
  const y1 = Math.min(ny - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const a = arr[y0 * nx + x0]
  const b = arr[y0 * nx + x1]
  const c = arr[y1 * nx + x0]
  const d = arr[y1 * nx + x1]
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
}

/** 将任意规则网格裁剪/重采样到目标 bbox（区域场上传用）。 */
export function clipToBbox(frame: FieldFrame, bbox: BBox, nx = 96, ny = 64): FieldFrame {
  const [tw, ts, te, tn] = bbox
  const [sw, ss, se, sn] = frame.bbox
  if (te <= sw || tw >= se || tn <= ss || ts >= sn) {
    const err = new Error('上传网格与当前区域无交集，请裁剪后重试') as Error & { code?: string }
    err.code = 'NO_OVERLAP'
    throw err
  }

  const u = new Float32Array(nx * ny)
  const v = new Float32Array(nx * ny)
  const scalar = frame.scalar ? new Float32Array(nx * ny) : undefined
  const mask = new Uint8Array(nx * ny)

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const lon = nx === 1 ? (tw + te) / 2 : tw + (ix / (nx - 1)) * (te - tw)
      const lat = ny === 1 ? (ts + tn) / 2 : ts + (iy / (ny - 1)) * (tn - ts)
      const gx = ((lon - sw) / (se - sw)) * (frame.nx - 1)
      const gy = ((lat - ss) / (sn - ss)) * (frame.ny - 1)
      const i = iy * nx + ix
      if (gx < -0.5 || gx > frame.nx - 0.5 || gy < -0.5 || gy > frame.ny - 0.5) {
        mask[i] = 0
        continue
      }
      u[i] = sampleBilinear(frame.u, frame.nx, frame.ny, gx, gy)
      v[i] = sampleBilinear(frame.v, frame.nx, frame.ny, gx, gy)
      if (scalar && frame.scalar) scalar[i] = sampleBilinear(frame.scalar, frame.nx, frame.ny, gx, gy)
      if (frame.mask) {
        const mx = Math.max(0, Math.min(frame.nx - 1, Math.round(gx)))
        const my = Math.max(0, Math.min(frame.ny - 1, Math.round(gy)))
        mask[i] = frame.mask[my * frame.nx + mx]
      } else {
        mask[i] = 1
      }
    }
  }

  return {
    nx,
    ny,
    bbox,
    time: frame.time,
    u,
    v,
    scalar,
    mask,
    kind: frame.kind,
    meta: { ...frame.meta },
  }
}

export function gridLonLat(frame: FieldFrame): { lon: Float32Array; lat: Float32Array } {
  const lon = new Float32Array(frame.nx)
  const lat = new Float32Array(frame.ny)
  for (let i = 0; i < frame.nx; i++) lon[i] = lonLatAt(frame, i, 0)[0]
  for (let j = 0; j < frame.ny; j++) lat[j] = lonLatAt(frame, 0, j)[1]
  return { lon, lat }
}
