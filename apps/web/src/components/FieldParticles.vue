<script setup lang="ts">
import { computed } from 'vue'
import { usesParticlePass } from '@aether/particles'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const live = computed(() => usesParticlePass(ui.kind))
</script>

<template>
  <span v-if="live" data-aether-particles="on" hidden />
</template>
