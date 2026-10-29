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
  color: #111;
  background: #fff;
  border-radius: 9999px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
}
@media (max-width: 720px) {
  .badge {
    top: 64px;
    right: 16px;
  }
}
</style>
