<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const show = computed(
  () => ui.page === 'global' && ui.kind === 'precip' && (field.frame?.meta.demo || field.activePack === 'global/precip'),
)
</script>

<template>
  <div v-if="show" class="badge" :title="field.frame?.meta.note || t.demoPrecipNote">{{ t.demoBadge }}</div>
</template>

<style scoped>
.badge {
  position: absolute;
  top: 64px;
  left: 196px;
  transform: none;
  z-index: 4;
  pointer-events: none;
  font-size: 11px;
  letter-spacing: 0.14em;
  font-weight: 600;
  color: var(--on-primary);
  background: var(--primary);
  border-radius: var(--radius-pill);
  padding: 3px 10px;
}
</style>
