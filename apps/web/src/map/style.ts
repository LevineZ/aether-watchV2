import type { StyleSpecification } from 'maplibre-gl'

const FONT = ['Noto Sans Regular']

function labelLayout(size: unknown, extra: Record<string, unknown> = {}) {
  return {
    'text-field': [
      'case',
      ['has', 'temp'],
      ['concat', ['get', 'name'], ' ', ['to-string', ['get', 'temp']], '°'],
      ['get', 'name'],
    ],
    'text-font': FONT,
    'text-size': size,
    'text-padding': 6,
    'text-optional': true,
    'text-max-width': 8,
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'symbol-sort-key': ['get', 'rank'],
    ...extra,
  }
}

const LABEL_PAINT = {
  'text-color': '#ffffff',
  'text-halo-color': 'rgba(0, 0, 0, 0.45)',
  'text-halo-width': 1.15,
  'text-halo-blur': 0.35,
}

const SIZE_FAR_NEAR = ['interpolate', ['linear'], ['zoom'], 0, 11, 2.4, 12, 5, 13, 7.5, 14]

/** 粒子插在第一层注记之前，白岸线/地名压在场上。 */
export const PLACE_BEFORE_ID = 'place-ocean'

export const mapStyle = {
  version: 8,
  name: 'aether-ventusky',
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
      paint: { 'background-color': '#0d0d0d' },
    },
    {
      id: 'land',
      type: 'fill',
      source: 'land',
      paint: { 'fill-color': '#1a1a1a', 'fill-opacity': 1 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#0d0d0d', 'fill-opacity': 1 },
    },
    {
      id: 'coast-line',
      type: 'line',
      source: 'land',
      paint: {
        'line-color': '#9aa0a6',
        'line-width': 0.85,
        'line-opacity': 0.85,
      },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['to-number', ['get', 'admin_level']], 2], ['!=', ['get', 'maritime'], 1]],
      paint: {
        'line-color': '#6b7280',
        'line-width': 0.45,
        'line-opacity': 0.22,
      },
    },
    {
      id: PLACE_BEFORE_ID,
      type: 'symbol',
      source: 'places',
      minzoom: 0,
      maxzoom: 3.2,
      filter: ['==', ['get', 'kind'], 'ocean'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 0, 11, 3, 12], {
        'text-letter-spacing': 0.1,
        'text-padding': 16,
      }),
      paint: { ...LABEL_PAINT, 'text-opacity': 0.8 },
    },
    {
      id: 'place-country',
      type: 'symbol',
      source: 'places',
      minzoom: 0,
      maxzoom: 4.2,
      filter: ['==', ['get', 'kind'], 'country'],
      layout: labelLayout(SIZE_FAR_NEAR, { 'text-padding': 10 }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-capital',
      type: 'symbol',
      source: 'places',
      minzoom: 0,
      filter: ['==', ['get', 'kind'], 'capital'],
      layout: labelLayout(SIZE_FAR_NEAR, { 'text-padding': 4, 'text-allow-overlap': true }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-region',
      type: 'symbol',
      source: 'places',
      minzoom: 0.9,
      filter: ['==', ['get', 'kind'], 'province'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 1.2, 11, 5, 13, 7, 14], {
        'text-padding': 4,
      }),
      paint: LABEL_PAINT,
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'places',
      minzoom: 3.2,
      filter: ['==', ['get', 'kind'], 'city'],
      layout: labelLayout(['interpolate', ['linear'], ['zoom'], 3.6, 11, 6, 13, 8, 14], {
        'text-padding': 3,
      }),
      paint: LABEL_PAINT,
    },
  ],
} as StyleSpecification
