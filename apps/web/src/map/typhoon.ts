import type { Map as MapLibreMap } from 'maplibre-gl'

const SRC = 'typhoon-demo'
const TRACK = 'typhoon-track'
const FORECAST = 'typhoon-forecast'
const DOTS = 'typhoon-dots'
const RING = 'typhoon-ring'
const CORE = 'typhoon-core'
const MARK = 'typhoon-mark'
const LABEL = 'typhoon-label'
const MARK_LABEL = 'typhoon-mark-label'

function cycloneBitmap(): ImageData {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.clearRect(0, 0, s, s)
  g.translate(s / 2, s / 2)
  g.strokeStyle = '#ff2d3d'
  g.lineWidth = 2.4
  g.lineCap = 'round'
  g.beginPath()
  for (let t = 0; t < Math.PI * 3.2; t += 0.12) {
    const r = 4 + t * 3.4
    const x = Math.cos(t) * r
    const y = Math.sin(t) * r
    if (t === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  return g.getImageData(0, 0, s, s)
}

function crossBitmap(): ImageData {
  const s = 32
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.clearRect(0, 0, s, s)
  g.strokeStyle = '#111111'
  g.lineWidth = 2.4
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(8, 8)
  g.lineTo(24, 24)
  g.moveTo(24, 8)
  g.lineTo(8, 24)
  g.stroke()
  return g.getImageData(0, 0, s, s)
}

const LAYERS = [TRACK, FORECAST, DOTS, RING, CORE, MARK, LABEL, MARK_LABEL]

/** 白虚线 + 紫点台风轨：仅壳叠，不进 FieldFrame。 */
export function ensureTyphoonOverlay(map: MapLibreMap, beforeId?: string) {
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined
  if (!map.hasImage('typhoon-icon')) {
    map.addImage('typhoon-icon', cycloneBitmap(), { pixelRatio: 2 })
  }
  if (!map.hasImage('typhoon-cross')) {
    map.addImage('typhoon-cross', crossBitmap(), { pixelRatio: 2 })
  }
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: '/geo/typhoon-demo.json' })
  }
  const linePaint = {
    'line-color': '#b44dff',
    'line-width': 1.15,
    'line-dasharray': [1.1, 1.8],
    'line-opacity': 0.92,
  }
  const fcstPaint = {
    'line-color': '#3ec6ff',
    'line-width': 1.15,
    'line-dasharray': [1.1, 1.8],
    'line-opacity': 0.92,
  }
  if (!map.getLayer(TRACK)) {
    map.addLayer(
      {
        id: TRACK,
        type: 'line',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'track'],
        paint: linePaint,
      },
      before,
    )
  }
  if (!map.getLayer(FORECAST)) {
    map.addLayer(
      {
        id: FORECAST,
        type: 'line',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'forecast'],
        paint: fcstPaint,
      },
      before,
    )
  }
  if (!map.getLayer(DOTS)) {
    map.addLayer(
      {
        id: DOTS,
        type: 'circle',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'dot'],
        paint: {
          'circle-radius': 2.4,
          'circle-color': [
            'match',
            ['get', 'phase'],
            'fcst',
            '#3ec6ff',
            'now',
            '#ff2d3d',
            '#b44dff',
          ],
          'circle-stroke-color': '#111111',
          'circle-stroke-width': 0.5,
        },
      },
      before,
    )
  }
  if (!map.getLayer(RING)) {
    map.addLayer(
      {
        id: RING,
        type: 'circle',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'center'],
        paint: {
          'circle-radius': 9,
          'circle-color': 'rgba(255,45,61,0.18)',
          'circle-stroke-color': '#ff2d3d',
          'circle-stroke-width': 1.4,
        },
      },
      before,
    )
  }
  if (!map.getLayer(CORE)) {
    map.addLayer(
      {
        id: CORE,
        type: 'circle',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'center'],
        paint: {
          'circle-radius': 3.2,
          'circle-color': '#ff2d3d',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      before,
    )
  }
  if (!map.getLayer(MARK)) {
    map.addLayer(
      {
        id: MARK,
        type: 'symbol',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'mark'],
        layout: {
          'icon-image': 'typhoon-cross',
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      before,
    )
  }
  if (!map.getLayer(LABEL)) {
    map.addLayer(
      {
        id: LABEL,
        type: 'symbol',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'center'],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 1.6],
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#f3f4f6',
          'text-halo-color': '#111111',
          'text-halo-width': 1.2,
          'text-halo-blur': 0.2,
        },
      },
      before,
    )
  }
  if (!map.getLayer(MARK_LABEL)) {
    map.addLayer(
      {
        id: MARK_LABEL,
        type: 'symbol',
        source: SRC,
        filter: ['==', ['get', 'kind'], 'mark'],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 1.55],
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#f3f4f6',
          'text-halo-color': '#111111',
          'text-halo-width': 1.2,
          'text-halo-blur': 0.2,
        },
      },
      before,
    )
  }
}

export function showTyphoonOverlay(map: MapLibreMap | null, on: boolean) {
  if (!map) return
  const vis = on ? 'visible' : 'none'
  for (const id of LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
  }
}
