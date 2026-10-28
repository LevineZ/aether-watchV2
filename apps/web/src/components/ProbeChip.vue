<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MapMouseEvent } from 'maplibre-gl'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const ui = useUiStore()
const text = ref('')
const x = ref(0)
const y = ref(0)
const on = ref(false)

function sample(lon: number, lat: number): string {
  const frame = field.frame
  if (!frame) return ''
  const [w, s, e, n] = frame.bbox
  if (lon < w || lon > e || lat < s || lat > n) return ''
  const gx = ((lon - w) / Math.max(e - w, 1e-6)) * (frame.nx - 1)
  const gy = ((lat - s) / Math.max(n - s, 1e-6)) * (frame.ny - 1)
  const ix = Math.round(Math.max(0, Math.min(frame.nx - 1, gx)))
  const iy = Math.round(Math.max(0, Math.min(frame.ny - 1, gy)))
  const i = iy * frame.nx + ix
  if (ui.kind === 'temp' && frame.scalar) return `${Math.round(frame.scalar[i])}°C`
  if (ui.kind === 'precip' && frame.scalar) return `${frame.scalar[i].toFixed(1)} mm`
  return `${Math.hypot(frame.u[i] ?? 0, frame.v[i] ?? 0).toFixed(1)} m/s`
}

function onMove(ev: MapMouseEvent) {
  const next = sample(ev.lngLat.lng, ev.lngLat.lat)
  text.value = next
  x.value = ev.point.x
  y.value = ev.point.y
  on.value = Boolean(next) && ui.labelsOn && ui.page !== 'about'
}

function onLeave() {
  on.value = false
}

let timer = 0

onMounted(() => {
  const bind = () => {
    const map = mapRuntime.map
    if (!map) {
      timer = window.setTimeout(bind, 160)
      return
    }
    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
  }
  bind()
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  const map = mapRuntime.map
  map?.off('mousemove', onMove)
  map?.off('mouseout', onLeave)
})
</script>

<template>
  <div v-if="on" class="probe" :style="{ transform: `translate(${x + 14}px, ${y - 18}px)` }">{{ text }}</div>
</template>

<style scoped>
.probe {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 5;
  pointer-events: none;
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  background: #fff;
  color: #111;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 650;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
}
</style>
