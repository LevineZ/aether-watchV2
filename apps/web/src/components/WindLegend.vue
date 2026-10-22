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
        title: t.value.legendTemp,
        bar: 'linear-gradient(90deg, #1e47b8, #59d1e6, #f2d647, #db382e)',
        ticks: ['−20', '0', '20', '40 °C'],
      }
    case 'precip':
      return {
        title: t.value.legendPrecip,
        bar: 'linear-gradient(90deg, rgba(140, 224, 242, 0.2), #8ce0f2 38%, #3847b8)',
        ticks: ['0', '2', '5', '10 mm'],
      }
    case 'ocean':
      return {
        title: t.value.legendOcean,
        bar: 'linear-gradient(90deg, rgba(126, 200, 232, 0.16), #7ec8e8 48%, #b8e0f0)',
        ticks: ['0', '0.5', '1', '2 m/s'],
      }
    default:
      return {
        title: t.value.legend,
        bar: 'linear-gradient(90deg, rgba(90, 200, 230, 0.12), #5ac8e6)',
        ticks: ['0', '8', '16', '24 m/s'],
      }
  }
})
</script>

<template>
  <div>
    <p class="panel-title">{{ spec.title }}</p>
    <div class="bar" :style="{ background: spec.bar }" />
    <div class="ticks">
      <span v-for="tick in spec.ticks" :key="tick">{{ tick }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar {
  height: 8px;
  border-radius: 99px;
}
.ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--ink-subtle);
  font-family: var(--font-mono);
}
</style>
