<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const spec = computed(() => {
  switch (ui.kind) {
    case 'temp':
      return {
        unit: '°C',
        title: t.value.legendTemp,
        bar: 'linear-gradient(180deg, #e07a1a 0%, #f0b429 22%, #d8de4a 48%, #7fbf3a 72%, #3d7a2a 100%)',
        ticks: ['50', '30', '10', '0', '−20', '−40'],
      }
    case 'precip':
      return {
        unit: 'mm',
        title: t.value.legendPrecip,
        bar: 'linear-gradient(180deg, #e8ffd4 0%, #7dcf6a 35%, #1f6b3a 65%, #0b1f14 100%)',
        ticks: ['20', '5', '1', '0'],
      }
    case 'ocean':
      return {
        unit: 'm/s',
        title: t.value.legendOcean,
        bar: 'linear-gradient(180deg, #f0c14a 0%, #7ec8a0 45%, #0d3a4a 100%)',
        ticks: ['2', '1', '0'],
      }
    default:
      return {
        unit: 'm/s',
        title: t.value.legend,
        bar: 'linear-gradient(180deg, #e07a1a 0%, #f0b429 28%, #c8de4a 55%, #3d8f4a 100%)',
        ticks: ['24', '12', '4', '0'],
      }
  }
})
</script>

<template>
  <aside v-if="ui.labelsOn && field.frame" class="scale" :aria-label="spec.title">
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
  top: 50%;
  right: 18px;
  transform: translateY(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}
.unit {
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.body {
  display: flex;
  align-items: stretch;
  gap: 6px;
  height: min(280px, 42vh);
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
  color: #fff;
  text-align: right;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.bar {
  width: 10px;
  border-radius: 99px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
</style>
