<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import TopNav from '@/components/TopNav.vue'
import MapHost from '@/components/MapHost.vue'
import Timeline from '@/components/Timeline.vue'
import LayerRail from '@/components/LayerRail.vue'
import ScaleBar from '@/components/ScaleBar.vue'
import MapTools from '@/components/MapTools.vue'
import UploadModal from '@/components/UploadModal.vue'
import AboutOverlay from '@/chrome/AboutOverlay.vue'
import RegionalChrome from '@/chrome/RegionalChrome.vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { mapRuntime } from '@/map/runtime'

const ui = useUiStore()
const field = useFieldStore()
const { page } = storeToRefs(ui)

watch(
  page,
  async (p) => {
    try {
      await field.showPage(p)
    } finally {
      if (p !== 'about') mapRuntime.resume()
      else mapRuntime.pause()
    }
    if (p !== 'regional') ui.uploadOpen = false
  },
  { immediate: true },
)
</script>

<template>
  <div class="shell">
    <div class="stage">
      <MapHost />
      <LayerRail v-show="page !== 'about'" />
      <ScaleBar v-show="page !== 'about'" />
      <MapTools v-show="page !== 'about'" />
      <Timeline v-show="page !== 'about'" />
      <RegionalChrome v-if="page === 'regional'" />
      <UploadModal v-if="page === 'regional' && field.uploaded && ui.uploadOpen" />
      <AboutOverlay v-if="page === 'about'" />
    </div>
    <TopNav />
  </div>
</template>
