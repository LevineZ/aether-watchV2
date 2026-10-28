<script setup lang="ts">
import type { FieldKind } from '@aether/field'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const layers: {
  id: FieldKind
  key: 'chipWind' | 'chipOcean' | 'chipTemp' | 'chipPrecip'
}[] = [
  { id: 'wind', key: 'chipWind' },
  { id: 'ocean', key: 'chipOcean' },
  { id: 'temp', key: 'chipTemp' },
  { id: 'precip', key: 'chipPrecip' },
]

function pick(kind: FieldKind) {
  if (field.isKindMissing(ui.page, kind)) return
  void field.selectKind(kind)
}
</script>

<template>
  <nav class="rail" role="tablist" :aria-label="t.elements">
    <button
      v-for="c in layers"
      :key="c.id"
      class="row"
      :class="{ on: ui.kind === c.id, missing: field.isKindMissing(ui.page, c.id) }"
      type="button"
      role="tab"
      :aria-selected="ui.kind === c.id"
      :aria-disabled="field.isKindMissing(ui.page, c.id)"
      :title="field.isKindMissing(ui.page, c.id) ? t.chipMissing : undefined"
      @click="pick(c.id)"
    >
      <svg v-if="c.id === 'wind'" class="ico" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 7.5h9.2a2.3 2.3 0 1 0-2.3-2.3" />
        <path d="M3 10.5h12a2.5 2.5 0 1 1-2.5 2.5" />
        <path d="M3 13.5h6.5" />
      </svg>
      <svg v-else-if="c.id === 'ocean'" class="ico" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2 8.5c2 1.6 3.6-1.6 5.6 0s3.6-1.6 5.6 0 3.6-1.6 4.8 0" />
        <path d="M2 12.2c2 1.6 3.6-1.6 5.6 0s3.6-1.6 5.6 0 3.6-1.6 4.8 0" />
      </svg>
      <svg v-else-if="c.id === 'temp'" class="ico" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M9 3.5v8.2a2.6 2.6 0 1 0 2 0V3.5a1 1 0 1 0-2 0z" />
        <path d="M9 11.2h2" />
      </svg>
      <svg v-else class="ico" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3.5v6.2" />
        <path d="M10 9.7c-2.4 0-4 1.7-4 3.6A3.6 3.6 0 0 0 10 17a3.6 3.6 0 0 0 4-3.7c0-1.9-1.6-3.6-4-3.6z" />
      </svg>
      <span>{{ t[c.key] }}</span>
    </button>
  </nav>
</template>

<style scoped>
.rail {
  position: absolute;
  top: 64px;
  left: 12px;
  z-index: 4;
  width: var(--rail-w);
  padding: 6px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 8px;
  color: var(--ink-muted);
  font-size: 13px;
  text-align: left;
}
.row:hover {
  color: var(--ink);
  background: rgba(232, 241, 248, 0.04);
}
.row.on {
  color: var(--ink);
  background: rgba(90, 200, 230, 0.16);
}
.row.missing {
  opacity: 0.38;
  cursor: not-allowed;
}
.ico {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 720px) {
  .rail {
    top: auto;
    bottom: 64px;
    width: auto;
    display: flex;
    max-width: calc(100vw - 80px);
  }
  .row span {
    display: none;
  }
  .row {
    width: 36px;
    padding: 0;
    justify-content: center;
  }
}
</style>
