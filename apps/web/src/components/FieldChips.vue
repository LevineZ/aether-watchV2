<script setup lang="ts">
import type { FieldKind } from '@aether/field'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const chips: { id: FieldKind; key: 'chipWind' | 'chipOcean' | 'chipTemp' | 'chipPrecip' }[] = [
  { id: 'wind', key: 'chipWind' },
  { id: 'ocean', key: 'chipOcean' },
  { id: 'temp', key: 'chipTemp' },
  { id: 'precip', key: 'chipPrecip' },
]

function pick(kind: FieldKind) {
  void field.selectKind(kind)
}
</script>

<template>
  <div class="chips" role="tablist" :aria-label="t.elements">
    <button
      v-for="c in chips"
      :key="c.id"
      class="btn-ghost"
      :class="{ active: ui.kind === c.id }"
      type="button"
      role="tab"
      :aria-selected="ui.kind === c.id"
      @click="pick(c.id)"
    >
      {{ t[c.key] }}
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
