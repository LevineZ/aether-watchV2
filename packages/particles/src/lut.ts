/** 256×1 1D colour LUTs. Shader samples with LINEAR; never stepwise mix7 bands. */

export type LutStop = { t: number; rgb: [number, number, number] }

/** ≥15 nodes: purple → blue → cyan → green → yellow → orange → red. */
export const TEMP_STOPS: LutStop[] = [
  { t: 0.0, rgb: [0.298, 0.055, 0.451] },
  { t: 0.07, rgb: [0.255, 0.118, 0.565] },
  { t: 0.14, rgb: [0.176, 0.220, 0.690] },
  { t: 0.21, rgb: [0.110, 0.365, 0.820] },
  { t: 0.28, rgb: [0.078, 0.541, 0.890] },
  { t: 0.35, rgb: [0.071, 0.710, 0.831] },
  { t: 0.42, rgb: [0.118, 0.780, 0.580] },
  { t: 0.5, rgb: [0.290, 0.831, 0.353] },
  { t: 0.57, rgb: [0.541, 0.851, 0.196] },
  { t: 0.64, rgb: [0.820, 0.851, 0.118] },
  { t: 0.71, rgb: [0.969, 0.780, 0.078] },
  { t: 0.78, rgb: [0.969, 0.580, 0.071] },
  { t: 0.85, rgb: [0.941, 0.365, 0.090] },
  { t: 0.92, rgb: [0.831, 0.157, 0.157] },
  { t: 1.0, rgb: [0.690, 0.055, 0.176] },
]

/** Radar-echo: deep blue → cyan → green, strong cores yellow/orange. */
export const PRECIP_STOPS: LutStop[] = [
  { t: 0.0, rgb: [0.031, 0.071, 0.157] },
  { t: 0.12, rgb: [0.039, 0.176, 0.412] },
  { t: 0.24, rgb: [0.047, 0.412, 0.588] },
  { t: 0.38, rgb: [0.078, 0.588, 0.412] },
  { t: 0.52, rgb: [0.196, 0.690, 0.196] },
  { t: 0.66, rgb: [0.620, 0.820, 0.118] },
  { t: 0.78, rgb: [0.941, 0.820, 0.078] },
  { t: 0.9, rgb: [0.941, 0.490, 0.078] },
  { t: 1.0, rgb: [0.851, 0.196, 0.118] },
]

export const WIND_STOPS: LutStop[] = [
  { t: 0.0, rgb: [0.255, 0.247, 0.557] },
  { t: 0.18, rgb: [0.180, 0.420, 0.910] },
  { t: 0.36, rgb: [0.090, 0.750, 0.820] },
  { t: 0.54, rgb: [0.450, 0.760, 0.180] },
  { t: 0.72, rgb: [0.960, 0.780, 0.120] },
  { t: 0.86, rgb: [0.940, 0.400, 0.080] },
  { t: 1.0, rgb: [0.760, 0.140, 0.280] },
]

export const OCEAN_STOPS: LutStop[] = [
  { t: 0.0, rgb: [0.020, 0.078, 0.176] },
  { t: 0.2, rgb: [0.039, 0.176, 0.314] },
  { t: 0.4, rgb: [0.078, 0.373, 0.510] },
  { t: 0.6, rgb: [0.220, 0.620, 0.720] },
  { t: 0.78, rgb: [0.498, 0.831, 0.910] },
  { t: 0.9, rgb: [0.620, 0.878, 0.922] },
  { t: 1.0, rgb: [0.780, 0.941, 0.949] },
]

export const LUT_WIDTH = 256

export function buildLut256(stops: LutStop[]): Uint8Array {
  if (stops.length < 2) throw new Error('lut needs ≥2 stops')
  const ordered = [...stops].sort((a, b) => a.t - b.t)
  const data = new Uint8Array(LUT_WIDTH * 4)
  for (let i = 0; i < LUT_WIDTH; i++) {
    const t = i / (LUT_WIDTH - 1)
    let a = ordered[0]
    let b = ordered[ordered.length - 1]
    for (let s = 0; s < ordered.length - 1; s++) {
      if (t >= ordered[s].t && t <= ordered[s + 1].t) {
        a = ordered[s]
        b = ordered[s + 1]
        break
      }
    }
    const span = Math.max(1e-6, b.t - a.t)
    const f = Math.max(0, Math.min(1, (t - a.t) / span))
    const i4 = i * 4
    data[i4] = Math.round((a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f) * 255)
    data[i4 + 1] = Math.round((a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f) * 255)
    data[i4 + 2] = Math.round((a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f) * 255)
    data[i4 + 3] = 255
  }
  return data
}

export function lutForOverlay(mode: 'temp' | 'precip' | 'wind' | 'ocean' | 'none'): Uint8Array {
  if (mode === 'precip') return buildLut256(PRECIP_STOPS)
  if (mode === 'ocean') return buildLut256(OCEAN_STOPS)
  if (mode === 'temp') return buildLut256(TEMP_STOPS)
  return buildLut256(WIND_STOPS)
}
