/** Sorted ascending. p in [0, 1]. */
export function percentileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const t = Math.min(1, Math.max(0, p)) * (sorted.length - 1)
  const i = Math.floor(t)
  const j = Math.min(sorted.length - 1, i + 1)
  const f = t - i
  return sorted[i] * (1 - f) + sorted[j] * f
}

/** Clamp v into [lo, hi] then map to 0–1. Degenerate span → 0. */
export function unitInterval(v: number, lo: number, hi: number): number {
  const span = hi - lo
  if (!Number.isFinite(v) || span <= 1e-6) return 0
  return Math.max(0, Math.min(1, (v - lo) / span))
}
