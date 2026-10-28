<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const label = computed(() => {
  if (ui.page === 'desk') return t.value.sampleBadge
  if (ui.page === 'global' && ui.kind === 'precip' && (field.frame?.meta.demo || field.activePack === 'global/precip')) {
    return t.value.demoBadge
  }
  return ''
})
</script>

<template>
  <div v-if="label" class="badge" :title="field.frame?.meta.note || label">{{ label }}</div>
</template>

<style scoped>
.badge {
  position: absolute;
  top: 72px;
  right: 16px;
  z-index: 5;
  pointer-events: none;
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chrome-ink);
  background: var(--chrome);
  border: 1px solid var(--panel-border);
  border-radius: 9999px;
  box-shadow: var(--shadow-pill);
}
@media (max-width: 720px) {
  .badge {
    top: 64px;
    right: 16px;
  }
}
</style>
