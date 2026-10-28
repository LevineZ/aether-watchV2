import type { Map as MapLibreMap } from 'maplibre-gl'
import type { ParticleLayer } from '@aether/particles'
import type { BBox } from '@aether/field'
import { applyBasemap, FIREFLY_BBOX, FIREFLY_MAX_ZOOM, REGIONAL_BBOX } from '@/map/basemap'

const FIREFLY_MIN_FLOOR = 4.2

export { FIREFLY_BBOX, REGIONAL_BBOX }

/** 模块单例：切 Tab 时同步 pause，不走 Vue 更新队列。 */
export const mapRuntime: {
  map: MapLibreMap | null
  particles: ParticleLayer | null
  pause: () => void
  resume: () => void
} = {
  map: null,
  particles: null,
  pause() {
    this.particles?.pause()
  },
  resume() {
    this.particles?.resume()
  },
}

export const CAMERAS = {
  global: { center: [20, 18] as [number, number], zoom: 1.55, pitch: 0, bearing: 0, globe: false },
  desk: { center: [128, 30] as [number, number], zoom: 4.15, pitch: 0, bearing: 0, globe: false },
  regional: { center: [124.5, 28.2] as [number, number], zoom: 5.1, pitch: 0, bearing: 0, globe: false },
  about: { center: [120, 22] as [number, number], zoom: 1.2, pitch: 0, bearing: 0, globe: true },
}

function projectionType(map: MapLibreMap): string | undefined {
  try {
    const proj = map.getProjection?.() as unknown
    if (typeof proj === 'string') return proj
    if (proj && typeof proj === 'object' && 'type' in proj) {
      const t = (proj as { type?: unknown }).type
      return typeof t === 'string' ? t : undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

let boundsTimer: ReturnType<typeof setTimeout> | null = null

export function lockBounds(_bbox: BBox | null, page: keyof typeof CAMERAS) {
  const map = mapRuntime.map
  if (!map) return
  if (boundsTimer) {
    clearTimeout(boundsTimer)
    boundsTimer = null
  }

  const apply = () => {
    boundsTimer = null
    const m = mapRuntime.map
    if (!m) return
    try {
      if (page === 'regional') {
        if (projectionType(m) !== 'mercator') return
        if (m.isMoving()) {
          m.once('idle', apply)
          return
        }
        const win = FIREFLY_BBOX
        m.setMinZoom(0)
        m.setMaxZoom(FIREFLY_MAX_ZOOM)
        m.setMaxBounds([
          [win[0], win[1]],
          [win[2], win[3]],
        ])
        const span = Math.max(win[2] - win[0], win[3] - win[1])
        const minZ = Math.max(FIREFLY_MIN_FLOOR, Math.log2(360 / Math.max(span, 1)) - 1.15)
        m.setMinZoom(minZ)
      } else {
        m.setMinZoom(0)
        m.setMaxZoom(22)
        m.setMaxBounds(null)
      }
    } catch (err) {
      console.warn('[aether] lockBounds skipped', err)
    }
  }

  if (page === 'regional') {
    boundsTimer = setTimeout(apply, 720)
  } else {
    apply()
  }
}

const PLACE_LAYERS = [
  'place-ocean',
  'place-country',
  'place-capital',
  'place-region',
  'place-city',
  'typhoon-label',
  'typhoon-mark-label',
]

export function setPlaceLabels(on: boolean) {
  const map = mapRuntime.map
  if (!map) return
  const vis = on ? 'visible' : 'none'
  for (const id of PLACE_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
  }
}

export function applyCamera(page: keyof typeof CAMERAS) {
  const map = mapRuntime.map
  if (!map) return
  const c = CAMERAS[page]
  applyBasemap(map, page, page === 'regional' ? 'ocean' : 'wind')
  lockBounds(page === 'regional' ? FIREFLY_BBOX : null, page)
  try {
    const want = c.globe ? 'globe' : 'mercator'
    const cur = projectionType(map)
    if (cur !== want && map.setProjection) {
      map.setProjection({ type: want })
    }
  } catch {
    /* globe optional */
  }
  try {
    map.easeTo({
      center: c.center,
      zoom: c.zoom,
      pitch: c.pitch,
      bearing: c.bearing,
      duration: 650,
    })
  } catch (err) {
    console.warn('[aether] easeTo skipped', err)
    try {
      map.jumpTo({ center: c.center, zoom: c.zoom, pitch: 0, bearing: 0 })
    } catch {
      /* ignore */
    }
  }
}
