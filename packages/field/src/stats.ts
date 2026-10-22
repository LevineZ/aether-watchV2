import type { FieldFrame } from './types'

export type FieldStats = {
  meanSpeed: number
  maxSpeed: number
  coverage: number
  valid: number
}

export function fieldStats(frame: FieldFrame): FieldStats {
  const n = frame.nx * frame.ny
  let sum = 0
  let max = 0
  let valid = 0
  for (let i = 0; i < n; i++) {
    if (frame.mask && frame.mask[i] === 0) continue
    const s = Math.hypot(frame.u[i], frame.v[i])
    if (!Number.isFinite(s)) continue
    valid++
    sum += s
    if (s > max) max = s
  }
  return {
    meanSpeed: valid ? sum / valid : 0,
    maxSpeed: max,
    coverage: n ? valid / n : 0,
    valid,
  }
}

export function scalarRange(frame: FieldFrame): [number, number] {
  const kind = frame.kind
  if (kind === 'temp') return [-20, 40]
  if (!frame.scalar) return [0, 1]
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < frame.scalar.length; i++) {
    if (frame.mask && frame.mask[i] === 0) continue
    const v = frame.scalar[i]
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min)) return [0, 1]
  if (kind === 'precip') {
    if (max <= 0) return [0, 1]
    return [0, max]
  }
  if (min === max) return [min - 1, max + 1]
  return [min, max]
}

export function uvRange(frame: FieldFrame): { u: [number, number]; v: [number, number] } {
  let umin = Infinity
  let umax = -Infinity
  let vmin = Infinity
  let vmax = -Infinity
  const n = frame.nx * frame.ny
  for (let i = 0; i < n; i++) {
    if (frame.mask && frame.mask[i] === 0) continue
    const u = frame.u[i]
    const v = frame.v[i]
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue
    if (u < umin) umin = u
    if (u > umax) umax = u
    if (v < vmin) vmin = v
    if (v > vmax) vmax = v
  }
  if (!Number.isFinite(umin)) return { u: [-1, 1], v: [-1, 1] }
  if (umin === umax) {
    umin -= 1
    umax += 1
  }
  if (vmin === vmax) {
    vmin -= 1
    vmax += 1
  }
  return { u: [umin, umax], v: [vmin, vmax] }
}
