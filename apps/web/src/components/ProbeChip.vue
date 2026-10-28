<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MapMouseEvent } from 'maplibre-gl'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { mapRuntime } from '@/map/runtime'
import { useT } from '@/i18n'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()
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
  if (ui.kind === 'ocean' && frame.mask && frame.mask[i] === 0) return t.value.missing
  if (ui.kind === 'temp' && frame.scalar) {
    const v = frame.scalar[i]
    return Number.isFinite(v) ? `${Math.round(v)}°C` : t.value.missing
  }
  if (ui.kind === 'precip' && frame.scalar) {
    const v = frame.scalar[i]
    return Number.isFinite(v) ? `${v.toFixed(1)} mm` : t.value.missing
  }
  const u = frame.u[i]
  const v = frame.v[i]
  if (!Number.isFinite(u) || !Number.isFinite(v)) return t.value.missing
  return `${Math.hypot(u, v).toFixed(1)} m/s`
}

function onClick(ev: MapMouseEvent) {
  if (ui.page === 'about' || !ui.labelsOn) {
    on.value = false
    return
  }
  const next = sample(ev.lngLat.lng, ev.lngLat.lat)
  text.value = next
  x.value = ev.point.x
  y.value = ev.point.y
  on.value = Boolean(next)
}

let timer = 0

onMounted(() => {
  const bind = () => {
    const map = mapRuntime.map
    if (!map) {
      timer = window.setTimeout(bind, 160)
      return
    }
    map.on('click', onClick)
  }
  bind()
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
  mapRuntime.map?.off('click', onClick)
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
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}
</style>
