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
        bar: 'linear-gradient(180deg, #6B0000 0%, #A50026 11%, #D73027 17%, #F46D43 22%, #FDAE61 28%, #FEE090 33%, #FFFFBF 39%, #E0F3F8 44%, #ABD9E9 50%, #74ADD1 56%, #4575B4 61%, #313695 67%, #1A1A6E 78%, #0D0D3D 89%, #05051A 100%)',
        ticks: ['50', '30', '10', '0', '−20', '−40'],
      }
    case 'precip':
      return {
        unit: 'mm',
        title: t.value.legendPrecip,
        bar: 'linear-gradient(180deg, #CC0000 0%, #FF6600 20%, #FFCC00 40%, #00CC66 55%, #0099FF 70%, #0066CC 85%, #003366 100%)',
        ticks: ['50', '10', '2', '0'],
      }
    case 'ocean':
      return {
        unit: 'm/s',
        title: t.value.legendOcean,
        bar: 'linear-gradient(180deg, #F0C14A 0%, #7EC8A0 45%, #0E4A5C 100%)',
        ticks: ['2', '1', '0'],
      }
    default:
      return {
        unit: 'm/s',
        title: t.value.legend,
        bar: 'linear-gradient(180deg, #9E0142 0%, #D53E4F 16%, #F46D43 34%, #FDAE61 50%, #FEE08B 64%, #E6F598 76%, #ABDDA4 86%, #66C2A5 94%, #3288BD 100%)',
        ticks: ['50', '25', '12', '0'],
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
  color: var(--chrome-ink);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
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
  color: var(--chrome-ink);
  text-align: right;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
.bar {
  width: 10px;
  border-radius: 99px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
</style>
