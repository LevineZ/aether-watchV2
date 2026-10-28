/** Ventusky-locked 256×1 LUTs. Scalar is packed 0–1 against these physical windows. */

export const WIND_LUT_RANGE: [number, number] = [0, 50]
export const TEMP_LUT_RANGE: [number, number] = [-40, 50]
export const PRECIP_LUT_RANGE: [number, number] = [0, 50]
export const OCEAN_LUT_RANGE: [number, number] = [0, 2]

export const CURTAIN_ALPHA = {
  wind: 0.55,
  temp: 0.58,
  precipDry: 0.04,
  precipWet: 0.62,
  ocean: 0.5,
} as const

type Stop = [value: number, hex: string, alpha?: number]

function hexRgba(hex: string, alpha = 1): [number, number, number, number] {
  const n = hex.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
    Math.round(Math.max(0, Math.min(1, alpha)) * 255),
  ]
}

function sampleStops(stops: Stop[], value: number): [number, number, number, number] {
  const sorted = stops
  if (value <= sorted[0][0]) return hexRgba(sorted[0][1], sorted[0][2] ?? 1)
  const last = sorted[sorted.length - 1]
  if (value >= last[0]) return hexRgba(last[1], last[2] ?? 1)
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (value > b[0]) continue
    const t = (value - a[0]) / Math.max(1e-6, b[0] - a[0])
    const ca = hexRgba(a[1], a[2] ?? 1)
    const cb = hexRgba(b[1], b[2] ?? 1)
    return [
      Math.round(ca[0] + (cb[0] - ca[0]) * t),
      Math.round(ca[1] + (cb[1] - ca[1]) * t),
      Math.round(ca[2] + (cb[2] - ca[2]) * t),
      Math.round(ca[3] + (cb[3] - ca[3]) * t),
    ]
  }
  return hexRgba(last[1], last[2] ?? 1)
}

/** High → low as listed in the spec; bake() sorts by value. */
export const TEMP_STOPS: Stop[] = [
  [50, '#6B0000'],
  [40, '#A50026'],
  [35, '#D73027'],
  [30, '#F46D43'],
  [25, '#FDAE61'],
  [20, '#FEE090'],
  [15, '#FFFFBF'],
  [10, '#E0F3F8'],
  [5, '#ABD9E9'],
  [0, '#74ADD1'],
  [-5, '#4575B4'],
  [-10, '#313695'],
  [-20, '#1A1A6E'],
  [-30, '#0D0D3D'],
  [-40, '#05051A'],
]

export const WIND_STOPS: Stop[] = [
  [0, '#3288BD'],
  [3, '#66C2A5'],
  [7, '#ABDDA4'],
  [12, '#E6F598'],
  [18, '#FEE08B'],
  [25, '#FDAE61'],
  [33, '#F46D43'],
  [42, '#D53E4F'],
  [50, '#9E0142'],
]

export const PRECIP_STOPS: Stop[] = [
  [0, '#003366', 0.08],
  [0.1, '#003366', 0.35],
  [0.5, '#0066CC', 0.55],
  [2, '#0099FF', 0.7],
  [5, '#00CC66', 0.78],
  [10, '#FFCC00', 0.85],
  [20, '#FF6600', 0.9],
  [50, '#CC0000', 0.95],
]

export const OCEAN_STOPS: Stop[] = [
  [0, '#0B1F2A'],
  [0.3, '#0E4A5C'],
  [0.7, '#168A8A'],
  [1.1, '#7EC8A0'],
  [2, '#F0C14A'],
]

export function bakeLut(stops: Stop[], lo: number, hi: number): Uint8Array {
  const sorted = [...stops].sort((a, b) => a[0] - b[0])
  const data = new Uint8Array(256 * 4)
  const span = hi - lo || 1
  for (let i = 0; i < 256; i++) {
    const value = lo + (i / 255) * span
    const [r, g, b, a] = sampleStops(sorted, value)
    const o = i * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = a
  }
  return data
}

export const LUT_WIND = bakeLut(WIND_STOPS, ...WIND_LUT_RANGE)
export const LUT_TEMP = bakeLut(TEMP_STOPS, ...TEMP_LUT_RANGE)
export const LUT_PRECIP = bakeLut(PRECIP_STOPS, ...PRECIP_LUT_RANGE)
export const LUT_OCEAN = bakeLut(OCEAN_STOPS, ...OCEAN_LUT_RANGE)

export function lutForKind(kind: 'wind' | 'temp' | 'precip' | 'ocean'): Uint8Array {
  if (kind === 'temp') return LUT_TEMP
  if (kind === 'precip') return LUT_PRECIP
  if (kind === 'ocean') return LUT_OCEAN
  return LUT_WIND
}

export function lutRangeForKind(kind: 'wind' | 'temp' | 'precip' | 'ocean'): [number, number] {
  if (kind === 'temp') return TEMP_LUT_RANGE
  if (kind === 'precip') return PRECIP_LUT_RANGE
  if (kind === 'ocean') return OCEAN_LUT_RANGE
  return WIND_LUT_RANGE
}
