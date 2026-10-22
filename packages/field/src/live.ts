import type { FieldFrame } from './types'
import { loadDemo } from './demo'

/**
 * 真源后置 stub：签名与 loadDemo 相同，不打 OM / OSCAR / CMEMS。
 * 演示壳默认走 demo；此处仅保证接口可替换。
 */
export async function loadLive(packId: string): Promise<FieldFrame> {
  const frame = await loadDemo(packId)
  return {
    nx: frame.nx,
    ny: frame.ny,
    bbox: frame.bbox,
    time: frame.time,
    u: frame.u,
    v: frame.v,
    scalar: frame.scalar,
    mask: frame.mask,
    kind: frame.kind,
    meta: {
      source: 'live',
      vars: [...frame.meta.vars, 'stub'],
      units: frame.meta.units,
      fill: frame.meta.fill,
    },
  }
}
