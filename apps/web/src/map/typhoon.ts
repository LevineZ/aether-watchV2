import type { Map as MapLibreMap } from 'maplibre-gl'

const SRC = 'typhoon-demo'
const TRACK = 'typhoon-track'
const CORE = 'typhoon-core'
const RING = 'typhoon-ring'
const LABEL = 'typhoon-label'

function cycloneBitmap(): ImageData {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.clearRect(0, 0, s, s)
  g.translate(s / 2, s / 2)
  g.strokeStyle = '#5ac8e6'
  g.lineWidth = 2.2
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
  g.beginPath()
  g.arc(0, 0, 3.2, 0, Math.PI * 2)
  g.stroke()
  return g.getImageData(0, 0, s, s)
}

/** 台风图标 + 虚线路径：仅壳叠，不进 FieldFrame。 */
export function ensureTyphoonOverlay(map: MapLibreMap, beforeId?: string) {
  const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined
  if (!map.hasImage('typhoon-icon')) {
    map.addImage('typhoon-icon', cycloneBitmap(), { pixelRatio: 2 })
  }
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: '/geo/typhoon-demo.json' })
  }
  if (!map.getLayer(TRACK)) {
    map.addLayer({
      id: TRACK,
      type: 'line',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'track'],
      paint: {
        'line-color': '#5ac8e6',
        'line-width': 1.35,
        'line-dasharray': [1.4, 1.6],
        'line-opacity': 0.85,
      },
    }, before)
  }
  if (!map.getLayer(RING)) {
    map.addLayer({
      id: RING,
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'center'],
      paint: {
        'circle-radius': 11,
        'circle-color': 'rgba(90,200,230,0.08)',
        'circle-stroke-color': '#5ac8e6',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.7,
      },
    }, before)
  }
  if (!map.getLayer(CORE)) {
    map.addLayer({
      id: CORE,
      type: 'symbol',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'center'],
      layout: {
        'icon-image': 'typhoon-icon',
        'icon-size': 0.72,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    }, before)
  }
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'center'],
      layout: {
        'text-field': 'DEMO',
        'text-size': 10,
        'text-offset': [0, 1.55],
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#5ac8e6',
        'text-halo-color': 'rgba(10,22,40,0.85)',
        'text-halo-width': 1.2,
      },
    }, before)
  }
}

export function showTyphoonOverlay(map: MapLibreMap | null, on: boolean) {
  if (!map) return
  const vis = on ? 'visible' : 'none'
  for (const id of [TRACK, RING, CORE, LABEL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis)
  }
}
