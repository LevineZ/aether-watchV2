<script setup lang="ts">
import type { FieldKind } from '@aether/field'
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const layers: { id: FieldKind; key: 'chipWind' | 'chipOcean' | 'chipTemp' | 'chipPrecip'; dot: string }[] = [
  { id: 'wind', key: 'chipWind', dot: 'var(--dot-wind)' },
  { id: 'temp', key: 'chipTemp', dot: 'var(--dot-temp)' },
  { id: 'precip', key: 'chipPrecip', dot: 'var(--dot-precip)' },
  { id: 'ocean', key: 'chipOcean', dot: 'var(--dot-ocean)' },
]

const heightLabel = computed(() => (ui.page === 'global' ? '2.0 m' : '10.0 m'))
const hoursDisabled = computed(() => !field.frame?.time || ui.page !== 'desk')

function pick(kind: FieldKind) {
  if (field.isKindMissing(ui.page, kind)) return
  void field.selectKind(kind)
}

function snapshotPng() {
  const canvas = mapRuntime.map?.getCanvas()
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `aether-${ui.page}-${ui.kind}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }, 'image/png')
}
</script>

<template>
  <aside class="dock">
    <div class="layers">
      <button
        v-for="c in layers"
        :key="c.id"
        class="row"
        :class="{ on: ui.kind === c.id, missing: field.isKindMissing(ui.page, c.id) }"
        type="button"
        :title="field.isKindMissing(ui.page, c.id) ? t.chipMissing : undefined"
        @click="pick(c.id)"
      >
        <span class="dot" :style="{ background: c.dot }" />
        {{ t[c.key] }}
      </button>
    </div>
    <div class="tools">
      <button class="chip muted" type="button" disabled :title="t.noLevels">
        {{ heightLabel }}
        <span class="hint">{{ t.noLevels }}</span>
      </button>
      <div class="pair">
        <button class="chip ghost" type="button" :title="t.layers">
          {{ t.layers }}
        </button>
        <button class="chip muted" type="button" disabled :title="hoursDisabled ? t.noTimes : t.hours">
          {{ t.hours }}
          <span class="hint">{{ t.noTimes }}</span>
        </button>
      </div>
      <button v-if="ui.page === 'regional'" class="chip primary" type="button" @click="ui.uploadOpen = true">
        {{ t.upload }}
      </button>
      <button class="chip ghost" type="button" @click="snapshotPng">{{ t.export }}</button>
    </div>
  </aside>
</template>

<style scoped>
.dock {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.layers,
.tools {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px 0 8px;
  border-radius: var(--radius-pill);
  color: var(--chrome-ink);
  font-size: 13px;
  background: transparent;
}
.row.on {
  background: var(--pill-on);
  color: var(--pill-on-ink);
}
.row.missing {
  opacity: 0.35;
  cursor: not-allowed;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
}
.chip {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  background: var(--chrome);
  color: var(--chrome-ink);
  border: 1px solid var(--panel-border);
  font-size: 12px;
  box-shadow: var(--shadow-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip.primary {
  background: var(--primary);
  color: var(--on-primary);
  border-color: transparent;
}
.chip.ghost {
  background: transparent;
  box-shadow: none;
}
.chip.muted {
  opacity: 0.45;
  cursor: default;
}
.hint {
  font-size: 10px;
  color: var(--chrome-muted);
}
.pair {
  display: flex;
  gap: 6px;
}
@media (max-width: 720px) {
  .tools {
    display: none;
  }
}
</style>
