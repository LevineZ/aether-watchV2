import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { PMTiles, Protocol } from 'pmtiles'

type BasemapPage = 'global' | 'desk' | 'regional' | 'about'

/** 东海演示窗：currents bbox 外扩 ~1°。maxBounds / PMTiles 都锁这份。 */
export const FIREFLY_BBOX: [number, number, number, number] = [116.5, 21.0, 132.5, 36.0]
/** 场包窗（OSCAR / currents），落在 Firefly 窗内。 */
export const REGIONAL_BBOX: [number, number, number, number] = [117.5, 22, 131.5, 35]

export const FIREFLY_MIN_ZOOM = 5
export const FIREFLY_MAX_ZOOM = 10
export const FIREFLY_PREFETCH_Z = [6, 7, 8] as const
export const FIREFLY_PATH = '/basemap/regional/firefly.pmtiles'
export const FIREFLY_ATTR = 'Esri, Maxar, Earthstar Geographics 等'

const SAT_BEFORE = 'land-line'
const REGIONAL_HIDE = ['water', 'land', 'land-line'] as const
const REGIONAL_SHOW = ['ecs-sat', 'ecs-ink'] as const

let protocol: Protocol | null = null
let prefetchOnce = false

export function ensurePmtilesProtocol() {
  if (protocol) return
  protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tilev4)
}

function vis(map: MapLibreMap, id: string, show: boolean) {
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
}

function lon2tile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z
}

function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
}

function fireflyArchiveUrl() {
  return `${window.location.origin}${FIREFLY_PATH}`
}

function fireflyTiles(): string[] {
  const liveKey = (import.meta.env.VITE_ESRI_API_KEY as string | undefined)?.trim()
  if (liveKey) {
    return [
      `https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(liveKey)}`,
    ]
  }
  // 必须走 tiles[]：MapLibre raster 的 url=TileJSON 不会稳定进 pmtiles 协议，
  // 角标归因可以有、prefetch Range 也可以有，图层树却不向瓦片取纹。
  return [`pmtiles://${fireflyArchiveUrl()}/{z}/{x}/{y}`]
}

function fireflyExtent() {
  const [w, s, e, n] = FIREFLY_BBOX
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  }
}

/** 把 Firefly raster 写进初始 style，避免 load 后再 addSource 漏绑。 */
export function styleWithRegionalRaster(base: StyleSpecification): StyleSpecification {
  const style = JSON.parse(JSON.stringify(base)) as StyleSpecification
  style.sources = style.sources ?? {}
  style.sources['ecs-sat'] = {
    type: 'raster',
    tiles: fireflyTiles(),
    tileSize: 256,
    minzoom: FIREFLY_MIN_ZOOM,
    maxzoom: FIREFLY_MAX_ZOOM,
    bounds: FIREFLY_BBOX,
    attribution: FIREFLY_ATTR,
  }
  style.sources['ecs-extent'] = {
    type: 'geojson',
    data: fireflyExtent(),
  }
  const layers = style.layers ?? []
  const before = layers.findIndex((l) => l.id === SAT_BEFORE)
  const insertAt = before >= 0 ? before : layers.length
  layers.splice(
    insertAt,
    0,
    {
      id: 'ecs-sat',
      type: 'raster',
      source: 'ecs-sat',
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0.94,
        'raster-saturation': -0.04,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0,
        'raster-brightness-max': 1,
      },
    },
    {
      id: 'ecs-ink',
      type: 'fill',
      source: 'ecs-extent',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': '#0a1628',
        'fill-opacity': 0.2,
      },
    },
  )
  style.layers = layers
  return style
}

/** 仅 /regional：Firefly 暗色卫星 + 墨蓝半透蒙版。全球/desk 轻矢量，禁止整站真彩。 */
export function applyBasemap(map: MapLibreMap | null, page: BasemapPage) {
  if (!map) return
  const regional = page === 'regional'
  for (const id of REGIONAL_SHOW) vis(map, id, regional)
  for (const id of REGIONAL_HIDE) vis(map, id, !regional)
  if (regional) prefetchFirefly()
}

export function prefetchFirefly() {
  if (prefetchOnce || typeof window === 'undefined') return
  prefetchOnce = true
  const url = fireflyArchiveUrl()
  let p = protocol?.get(url)
  if (!p) {
    p = new PMTiles(url)
    protocol?.add(p)
  }
  const [w, s, e, n] = FIREFLY_BBOX
  void (async () => {
    try {
      await p.getHeader()
      for (const z of FIREFLY_PREFETCH_Z) {
        const x0 = Math.floor(lon2tile(w, z))
        const x1 = Math.floor(lon2tile(e - 1e-9, z))
        const y0 = Math.floor(lat2tile(n, z))
        const y1 = Math.floor(lat2tile(s + 1e-9, z))
        const jobs: Promise<unknown>[] = []
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) jobs.push(p.getZxy(z, x, y).catch(() => null))
        }
        await Promise.all(jobs)
      }
    } catch {
      /* 无私有缓存时不拉公网大图 */
    }
  })()
}

/** 若初始 style 未挂上源（热更/旧构建），load 后再补 tiles[]。 */
export function addRegionalRaster(map: MapLibreMap) {
  if (!map.getSource('ecs-sat')) {
    map.addSource('ecs-sat', {
      type: 'raster',
      tiles: fireflyTiles(),
      tileSize: 256,
      minzoom: FIREFLY_MIN_ZOOM,
      maxzoom: FIREFLY_MAX_ZOOM,
      bounds: FIREFLY_BBOX,
      attribution: FIREFLY_ATTR,
    })
  }
  if (!map.getLayer('ecs-sat')) {
    map.addLayer(
      {
        id: 'ecs-sat',
        type: 'raster',
        source: 'ecs-sat',
        layout: { visibility: 'none' },
        paint: {
          'raster-opacity': 0.94,
          'raster-saturation': -0.04,
          'raster-contrast': 0.12,
          'raster-brightness-min': 0,
          'raster-brightness-max': 1,
        },
      },
      map.getLayer(SAT_BEFORE) ? SAT_BEFORE : undefined,
    )
  }
  if (!map.getSource('ecs-extent')) {
    map.addSource('ecs-extent', {
      type: 'geojson',
      data: fireflyExtent(),
    })
  }
  if (!map.getLayer('ecs-ink')) {
    map.addLayer(
      {
        id: 'ecs-ink',
        type: 'fill',
        source: 'ecs-extent',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#0a1628',
          'fill-opacity': 0.2,
        },
      },
      map.getLayer(SAT_BEFORE) ? SAT_BEFORE : undefined,
    )
  }
}
