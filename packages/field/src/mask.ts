import { inferKind, type FieldFrame, type FieldKind } from './types'

/** 仅 ocean 允许硬海 mask。temp / precip / wind 必须丢掉，避免切场陆地洞残留。 */
export function applyMaskContract(frame: FieldFrame): FieldFrame {
  const kind = inferKind(frame)
  frame.kind = kind
  if (kind !== 'ocean' && frame.mask) delete frame.mask
  return frame
}

export function allowsOceanMask(kind: FieldKind | undefined): boolean {
  return kind === 'ocean'
}
