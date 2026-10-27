<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import { ParticleLayer } from '@aether/particles'
import { mapStyle, PLACE_BEFORE_ID } from '@/map/style'
import { mapRuntime, applyCamera } from '@/map/runtime'
import { addRegionalRaster, applyBasemap, ensurePmtilesProtocol, styleWithRegionalRaster } from '@/map/basemap'
import { ensureTyphoonOverlay, showTyphoonOverlay } from '@/map/typhoon'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import DemoBadge from './DemoBadge.vue'

const root = ref<HTMLElement | null>(null)
const ui = useUiStore()
const field = useFieldStore()
const t = useT()
let map: maplibregl.Map | null = null
let ro: ResizeObserver | null = null

function syncParticles() {
  const p = mapRuntime.particles
  if (!p) return
  p.applyKindLook(ui.kind)
  if (field.frame) p.setFrame(field.frame)
}

onMounted(() => {
  if (!root.value) return
  ensurePmtilesProtocol()
  map = new maplibregl.Map({
    container: root.value,
    style: styleWithRegionalRaster(mapStyle),
    center: [120, 22],
    zoom: 1.35,
    attributionControl: false,
    fadeDuration: 0,
    maxPitch: 0,
    canvasContextAttributes: { antialias: true, alpha: true, preserveDrawingBuffer: false },
  })
  mapRuntime.map = map
  const particles = new ParticleLayer({ id: 'aether-particles' })
  map.on('load', () => {
    if (map) addRegionalRaster(map)
    map?.addLayer(particles, PLACE_BEFORE_ID)
    if (map) ensureTyphoonOverlay(map, PLACE_BEFORE_ID)
    mapRuntime.particles = particles
    particles.setDensity(ui.density)
    map?.resize()
    applyCamera(ui.page)
    applyBasemap(map, ui.page, ui.kind)
    showTyphoonOverlay(map, ui.page === 'global')
    syncParticles()
    particles.resume()
    field.preloadIdle()
    map?.resize()
  })
  ro = new ResizeObserver(() => map?.resize())
  ro.observe(root.value)
})

watch(
  () => [ui.page, ui.kind, field.frame] as const,
  () => {
    if (map) applyBasemap(map, ui.page, ui.kind)
    showTyphoonOverlay(map, ui.page === 'global')
    syncParticles()
  },
)

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  mapRuntime.pause()
  mapRuntime.particles = null
  mapRuntime.map = null
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-wrap">
    <div class="map-host" ref="root" />
    <DemoBadge />
    <div v-if="field.status === 'loading'" class="toast glass">{{ t.loading }}</div>
    <div v-else-if="field.status === 'error'" class="toast glass err">
      {{ t.error }}：{{ field.error }}
      <button class="btn-primary" type="button" @click="field.showPage(ui.page)">{{ t.retry }}</button>
      <button class="btn-ghost" type="button" @click="field.selectKind('wind')">{{ t.chipWind }}</button>
    </div>
  </div>
</template>

<style scoped>
.toast {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 8px 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  pointer-events: auto;
}
.err {
  color: var(--semantic-danger);
}
</style>
