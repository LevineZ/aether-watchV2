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
        bar: 'linear-gradient(180deg, #c0392b 0%, #e67e22 18%, #f1c40f 36%, #2ecc71 54%, #12a0c8 72%, #1e3cb8 86%, #3a0a6e 100%)',
        ticks: ['50', '20', '0', '−20', '−40'],
      }
    case 'precip':
      return {
        unit: 'mm',
        title: t.value.legendPrecip,
        bar: 'linear-gradient(180deg, #d41438 0%, #b1147a 22%, #2914b8 48%, #2e78db 70%, #c7ecf9 100%)',
        ticks: ['10', '5', '2', '0'],
      }
    case 'ocean':
      return {
        unit: 'm/s',
        title: t.value.legendOcean,
        bar: 'linear-gradient(180deg, #e66129 0%, #f0b838 28%, #33c29e 55%, #0d496e 100%)',
        ticks: ['2', '1', '0.5', '0'],
      }
    default:
      return {
        unit: 'm/s',
        title: t.value.legend,
        bar: 'linear-gradient(180deg, #8b1a7a 0%, #e23a2c 18%, #f0a020 36%, #c8d42a 54%, #1fb064 72%, #17406b 100%)',
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
