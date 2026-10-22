<script setup lang="ts">
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import TopNav from '@/components/TopNav.vue'
import MapHost from '@/components/MapHost.vue'
import Timeline from '@/components/Timeline.vue'
import GlobalChrome from '@/chrome/GlobalChrome.vue'
import DeskChrome from '@/chrome/DeskChrome.vue'
import RegionalChrome from '@/chrome/RegionalChrome.vue'
import AboutOverlay from '@/chrome/AboutOverlay.vue'
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
  },
  { immediate: true },
)
</script>

<template>
  <div class="shell">
    <TopNav />
    <div class="stage">
      <MapHost />
      <GlobalChrome v-show="page === 'global'" />
      <DeskChrome v-show="page === 'desk'" />
      <RegionalChrome v-show="page === 'regional'" />
      <AboutOverlay v-if="page === 'about'" />
      <Timeline v-show="page !== 'about'" />
    </div>
  </div>
</template>
