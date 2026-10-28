<script setup lang="ts">
import LayerRail from '@/components/LayerRail.vue'
import ScaleBar from '@/components/ScaleBar.vue'
import MapTools from '@/components/MapTools.vue'
</script>

<template>
  <div class="overlay">
    <LayerRail />
    <MapTools />
    <ScaleBar />
  </div>
</template>
