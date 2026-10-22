<script setup lang="ts">
import RadarCard from '@/components/RadarCard.vue'
import RenderDock from '@/components/RenderDock.vue'
</script>

<template>
  <div class="overlay">
    <div class="tl">
      <RadarCard />
    </div>
    <div class="br">
      <RenderDock />
    </div>
  </div>
</template>

<style scoped>
.tl {
  position: absolute;
  top: 12px;
  left: 12px;
}
.br {
  position: absolute;
  right: 12px;
  bottom: 100px;
}
@media (max-width: 960px) {
  .br {
    left: 12px;
    right: 12px;
    bottom: 96px;
  }
  .br :deep(.dock) {
    width: 100%;
  }
}
</style>
