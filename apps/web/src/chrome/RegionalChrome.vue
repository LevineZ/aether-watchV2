<script setup lang="ts">
import { ref } from 'vue'
import LayerRail from '@/components/LayerRail.vue'
import ScaleBar from '@/components/ScaleBar.vue'
import MapTools from '@/components/MapTools.vue'
import NcUpload from '@/components/NcUpload.vue'
import { useT } from '@/i18n'

const t = useT()
const open = ref(true)
</script>

<template>
  <div class="overlay">
    <LayerRail />
    <MapTools />
    <ScaleBar />
    <section class="upload glass">
      <button class="head" type="button" @click="open = !open">
        <span>{{ t.ncTitle }}</span>
        <span class="chev">{{ open ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open" class="body">
        <NcUpload />
      </div>
    </section>
  </div>
</template>

<style scoped>
.upload {
  position: absolute;
  right: 70px;
  bottom: 64px;
  width: min(280px, calc(100vw - 96px));
  z-index: 4;
}
.head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
}
.body {
  padding: 0 12px 12px;
}
@media (max-width: 720px) {
  .upload {
    left: 12px;
    right: 12px;
    width: auto;
  }
}
</style>
