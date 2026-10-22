import type { StyleSpecification } from 'maplibre-gl'

const FONT = ['Noto Sans Regular']

function labelLayout(size: unknown, extra: Record<string, unknown> = {}) {
  return {
    'text-field': ['get', 'name'],
    'text-font': FONT,
    'text-size': size,
    'text-padding': 6,
    'text-optional': true,
    'text-max-width': 7,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'symbol-sort-key': ['get', 'rank'],
    ...extra,
  }
}

const LABEL_PAINT = {
  'text-color': '#c8d6e5',
  'text-halo-color': 'rgba(10, 22, 40, 0.6)',
  'text-halo-width': 1.25,
  'text-halo-blur': 0.2,
}

/** 远 11–12 / 近 13–14 */
const SIZE_FAR_NEAR = ['interpolate', ['linear'], ['zoom'], 0, 11, 2.4, 12, 5, 13, 7.5, 14]

/** 粒子插在第一层注记之前，地名始终压在场上并走碰撞避让。 */
export const PLACE_BEFORE_ID = 'place-ocean'

export const mapStyle = {
  version: 8,
  name: 'aether-ink',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      maxzoom: 14,
    },
    land: {
      type: 'geojson',
      data: '/geo/ne_110m_land.geojson',
    },
    places: {
      type: 'geojson',
      data: '/geo/places.json',
    },
  },
  layers: [
    {
      id: 'bg',
      type: 'background',
      paint: { 'background-color': '#0b1a2e' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#0a1628' },
    },
    {
      id: 'land',
      type: 'fill',
      source: 'land',
      paint: {
        'fill-color': '#13243B',
        'fill-opacity': 1,
      },
    },
    {
      id: 'land-line',
      type: 'line',
      source: 'land',
      paint: {
        'line-color': 'rgba(90,200,230,0.22)',
        'line-width': 0.8,
      },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['to-number', ['get', 'admin_level']], 2], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': 'rgba(90,200,230,0.32)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.2],
      },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      minzoom: 3.4,
      filter: ['==', ['to-number', ['get', 'admin_level']], 4],
      paint: {
        'line-color': 'rgba(90,200,230,0.16)',
        'line-width': 0.6,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: PLACE_BEFORE_ID,
      type: 'symbol',
      source: 'places',
      minzoom: 0,
      maxzoom: 3.8,
      filter: ['==', ['get', 'kind'], 'ocean'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 0, 12, 3, 13, 5, 14], {
        'text-letter-spacing': 0.12,
        'text-padding': 14,
      }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: 'places',
      minzoom: 0,
      maxzoom: 4.4,
      filter: ['==', ['get', 'kind'], 'country'],
      layout: labelLayout(SIZE_FAR_NEAR, { 'text-padding': 10 }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-sea',
      type: 'symbol',
      source: 'places',
      minzoom: 3.2,
      filter: ['==', ['get', 'kind'], 'sea'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 3.2, 11, 6, 13], {
        'text-letter-spacing': 0.08,
        'text-padding': 8,
      }),
      paint: { ...LABEL_PAINT, 'text-opacity': 0.88 },
    },
    {
      id: 'place-capital',
      type: 'symbol',
      source: 'places',
      minzoom: 2.5,
      filter: ['==', ['get', 'kind'], 'capital'],
      layout: labelLayout(SIZE_FAR_NEAR, { 'text-padding': 5 }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-region',
      type: 'symbol',
      source: 'places',
      minzoom: 3.15,
      filter: ['==', ['get', 'kind'], 'province'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 3.2, 11, 5, 13, 7, 14], {
        'text-padding': 4,
      }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'places',
      minzoom: 3.55,
      filter: ['==', ['get', 'kind'], 'city'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 3.6, 11, 6, 13, 8, 14], {
        'text-padding': 3,
      }),
      paint: LABEL_PAINT,
    },
  ],
} as StyleSpecification
