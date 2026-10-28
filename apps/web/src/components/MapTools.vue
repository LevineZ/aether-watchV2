<script setup lang="ts">
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const t = useT()

function zoomBy(delta: number) {
  const map = mapRuntime.map
  if (!map) return
  map.easeTo({ zoom: map.getZoom() + delta, duration: 240 })
}
</script>

<template>
  <div class="tools">
    <button type="button" :title="t.zoomIn" @click="zoomBy(0.8)">+</button>
    <button type="button" :title="t.zoomOut" @click="zoomBy(-0.8)">−</button>
  </div>
</template>

<style scoped>
.tools {
  position: absolute;
  right: 16px;
  bottom: 72px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tools button {
  width: 40px;
  height: 40px;
  border-radius: 99px;
  background: #111;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  box-shadow: var(--shadow-pill);
}
</style>
