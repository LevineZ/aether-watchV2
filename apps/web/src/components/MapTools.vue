<script setup lang="ts">
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'
import { useUiStore } from '@/stores/ui'

const t = useT()
const ui = useUiStore()

function zoomBy(delta: number) {
  const map = mapRuntime.map
  if (!map) return
  map.easeTo({ zoom: map.getZoom() + delta, duration: 240 })
}

function fly(center: [number, number], zoom: number) {
  mapRuntime.map?.easeTo({ center, zoom, duration: 800 })
}

function reset() {
  if (ui.page === 'desk') fly([108, 34], 4.1)
  else if (ui.page === 'regional') fly([124.5, 28.5], 5.8)
  else fly([120, 22], 1.35)
}
</script>

<template>
  <div class="tools">
    <button type="button" :title="t.zoomIn" @click="zoomBy(0.8)">+</button>
    <button type="button" :title="t.zoomOut" @click="zoomBy(-0.8)">−</button>
    <button type="button" :title="t.globe" @click="mapRuntime.map?.setProjection?.({ type: 'globe' })">
      {{ t.globeShort }}
    </button>
    <button type="button" :title="t.mercator" @click="mapRuntime.map?.setProjection?.({ type: 'mercator' })">
      {{ t.mapShort }}
    </button>
    <button type="button" :title="t.reset" @click="reset">{{ t.resetShort }}</button>
  </div>
</template>

<style scoped>
.tools {
  position: absolute;
  top: 64px;
  right: 12px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  width: 36px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.tools button {
  height: 36px;
  color: var(--ink);
  font-size: 13px;
  border-bottom: 1px solid var(--panel-border);
}
.tools button:last-child {
  border-bottom: 0;
}
.tools button:hover {
  background: rgba(90, 200, 230, 0.12);
  color: var(--primary);
}
@media (max-width: 720px) {
  .tools {
    top: auto;
    bottom: 120px;
  }
}
</style>
