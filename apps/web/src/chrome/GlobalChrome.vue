<script setup lang="ts">
import { computed } from 'vue'
import type { FieldFrame } from '@aether/field'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'
import Sparkline from '@/components/Sparkline.vue'
import WindLegend from '@/components/WindLegend.vue'
import FieldChips from '@/components/FieldChips.vue'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()

const spark = computed(() => {
  const m = field.stats?.meanSpeed ?? 8
  return Array.from({ length: 24 }, (_, i) => 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(i / 3 + m)))
})

function scalarSummary(frame: FieldFrame | null): { mean: number; max: number } {
  if (!frame?.scalar) return { mean: 0, max: 0 }
  const s = frame.scalar
  const mask = frame.mask
  let sum = 0
  let max = -Infinity
  let n = 0
  for (let i = 0; i < s.length; i++) {
    if (mask && mask[i] === 0) continue
    const v = s[i]
    if (!Number.isFinite(v)) continue
    n++
    sum += v
    if (v > max) max = v
  }
  return { mean: n ? sum / n : 0, max: Number.isFinite(max) ? max : 0 }
}

const cards = computed(() => {
  const coverage = `${Math.round((field.stats?.coverage ?? 0) * 100)}%`
  const kind = ui.kind
  if (kind === 'temp') {
    const { mean, max } = scalarSummary(field.frame)
    return [
      { k: t.value.meanTemp, v: `${mean.toFixed(1)} °C` },
      { k: t.value.maxTemp, v: `${max.toFixed(1)} °C` },
      { k: t.value.coverage, v: coverage },
    ]
  }
  if (kind === 'precip') {
    const { mean, max } = scalarSummary(field.frame)
    return [
      { k: t.value.meanPrecip, v: `${mean.toFixed(1)} mm` },
      { k: t.value.maxPrecip, v: `${max.toFixed(1)} mm` },
      { k: t.value.coverage, v: coverage },
    ]
  }
  if (kind === 'ocean') {
    return [
      { k: t.value.meanCurrent, v: `${(field.stats?.meanSpeed ?? 0).toFixed(2)} m/s` },
      { k: t.value.maxCurrent, v: `${(field.stats?.maxSpeed ?? 0).toFixed(2)} m/s` },
      { k: t.value.coverage, v: coverage },
      { k: t.value.particles, v: field.frame ? '400k GPU' : '—' },
    ]
  }
  return [
    { k: t.value.meanWind, v: `${(field.stats?.meanSpeed ?? 0).toFixed(1)} m/s` },
    { k: t.value.maxGust, v: `${(field.stats?.maxSpeed ?? 0).toFixed(1)} m/s` },
    { k: t.value.coverage, v: coverage },
    { k: t.value.particles, v: field.frame ? '400k GPU' : '—' },
  ]
})

function fly(center: [number, number], zoom: number) {
  mapRuntime.map?.easeTo({ center, zoom, duration: 800 })
}
</script>

<template>
  <div class="overlay">
    <aside class="glass left">
      <p class="panel-title">{{ t.metrics }}</p>
      <div class="grid">
        <div v-for="c in cards" :key="c.k" class="metric">
          <div class="k">{{ c.k }}</div>
          <div class="v">{{ c.v }}</div>
        </div>
      </div>
      <p class="panel-title" style="margin-top: 14px">{{ t.trend }}</p>
      <Sparkline :values="spark" />
      <WindLegend />
    </aside>
    <aside class="glass right">
      <p class="panel-title">{{ t.viewCtrl }}</p>
      <div class="row">
        <button class="btn-ghost" type="button" @click="mapRuntime.map?.setProjection?.({ type: 'globe' })">
          {{ t.globe }}
        </button>
        <button class="btn-ghost" type="button" @click="mapRuntime.map?.setProjection?.({ type: 'mercator' })">
          {{ t.mercator }}
        </button>
        <button class="btn-ghost" type="button" @click="fly([120, 22], 1.35)">{{ t.reset }}</button>
      </div>
      <p class="panel-title" style="margin-top: 14px">{{ t.quickNav }}</p>
      <div class="row wrap">
        <button class="btn-ghost" type="button" @click="fly([-150, 10], 2.1)">{{ t.pacific }}</button>
        <button class="btn-ghost" type="button" @click="fly([-40, 35], 2.4)">{{ t.atlantic }}</button>
        <button class="btn-ghost" type="button" @click="fly([70, 0], 2.3)">{{ t.indian }}</button>
        <button class="btn-ghost" type="button" @click="fly([124, 28], 4.2)">{{ t.chinaSea }}</button>
      </div>
      <p class="panel-title" style="margin-top: 14px">{{ t.elements }}</p>
      <FieldChips />
      <p class="panel-title" style="margin-top: 14px">{{ t.dataInfo }}</p>
      <p class="muted">{{ t.livePlaceholder }}</p>
      <p class="src">
        <span class="dot" />
        {{ t.sourceDemo }} · {{ field.frame?.nx }}×{{ field.frame?.ny }}
      </p>
    </aside>
  </div>
</template>

<style scoped>
.left,
.right {
  position: absolute;
  top: 12px;
  width: var(--side);
  padding: 14px;
  max-height: calc(100% - 110px);
  overflow: auto;
}
.left {
  left: 12px;
}
.right {
  right: 12px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.metric {
  background: rgba(10, 22, 40, 0.35);
  border-radius: var(--radius-md);
  padding: 10px;
}
.k {
  font-size: 11px;
  color: var(--ink-muted);
}
.v {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
}
.row {
  display: flex;
  gap: 6px;
}
.wrap {
  flex-wrap: wrap;
}
.src {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-muted);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: var(--semantic-ok);
}
@media (max-width: 960px) {
  .left,
  .right {
    width: min(280px, calc(100vw - 24px));
    max-height: 42%;
  }
  .right {
    top: auto;
    bottom: 100px;
  }
}
</style>
