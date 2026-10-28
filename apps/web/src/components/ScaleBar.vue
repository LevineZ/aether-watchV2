<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'

const ui = useUiStore()
const t = useT()

const spec = computed(() => {
  switch (ui.kind) {
    case 'temp':
      return {
        unit: '°C',
        title: t.value.legendTemp,
        bar: 'linear-gradient(180deg, #db382e 0%, #f2d647 32%, #59d1e6 68%, #1e47b8 100%)',
        ticks: ['50', '20', '−10', '−40'],
      }
    case 'precip':
      return {
        unit: 'mm',
        title: t.value.legendPrecip,
        bar: 'linear-gradient(180deg, #3847b8 0%, #8ce0f2 55%, rgba(140, 224, 242, 0.15) 100%)',
        ticks: ['10', '5', '2', '0'],
      }
    case 'ocean':
      return {
        unit: 'm/s',
        title: t.value.legendOcean,
        bar: 'linear-gradient(180deg, #b8e0f0 0%, #7ec8e8 45%, rgba(126, 200, 232, 0.18) 100%)',
        ticks: ['2', '1', '0.5', '0'],
      }
    default:
      return {
        unit: 'm/s',
        title: t.value.legend,
        bar: 'linear-gradient(180deg, #db4729 0%, #f2db47 28%, #40d1b8 55%, #278cd9 78%, #142a6b 100%)',
        ticks: ['24', '16', '8', '0'],
      }
  }
})
</script>

<template>
  <aside class="scale" :aria-label="spec.title">
    <div class="unit">{{ spec.unit }}</div>
    <div class="body">
      <ol class="ticks">
        <li v-for="tick in spec.ticks" :key="tick">{{ tick }}</li>
      </ol>
      <div class="bar" :style="{ background: spec.bar }" />
    </div>
  </aside>
</template>

<style scoped>
.scale {
  position: absolute;
  top: 220px;
  right: 12px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}
.unit {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  padding: 2px 6px;
}
.body {
  display: flex;
  align-items: stretch;
  gap: 6px;
  height: min(320px, 46vh);
}
.ticks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  text-shadow: 0 1px 2px rgba(10, 22, 40, 0.85);
  text-align: right;
}
.bar {
  width: 14px;
  border: 1px solid rgba(232, 241, 248, 0.18);
  box-shadow: var(--shadow-float);
}
</style>
