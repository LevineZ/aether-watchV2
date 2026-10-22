<script setup lang="ts">
import { useT } from '@/i18n'
const t = useT()
</script>

<template>
  <div>
    <p class="panel-title">{{ t.legend }}</p>
    <div class="bar" />
    <div class="ticks">
      <span>0</span>
      <span>8</span>
      <span>16</span>
      <span>24 m/s</span>
    </div>
  </div>
</template>

<style scoped>
.bar {
  height: 8px;
  border-radius: 99px;
  background: linear-gradient(90deg, rgba(90, 200, 230, 0.12), #5ac8e6);
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
