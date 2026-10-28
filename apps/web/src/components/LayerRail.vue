<script setup lang="ts">
import type { FieldKind } from '@aether/field'
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

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

function pick(kind: FieldKind) {
  if (field.isKindMissing(ui.page, kind)) return
  void field.selectKind(kind)
}

function download() {
  const frame = field.frame
  const blob = new Blob(
    [JSON.stringify({ note: '示例数据 · FieldFrame meta only', nx: frame?.nx, ny: frame?.ny, bbox: frame?.bbox, time: frame?.time, meta: frame?.meta }, null, 2)],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'aether-field-meta.json'
  a.click()
  URL.revokeObjectURL(a.href)
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
        @click="pick(c.id)"
      >
        <span class="dot" :style="{ background: c.dot }" />
        {{ t[c.key] }}
      </button>
    </div>
    <div class="tools">
      <button class="chip on" type="button" :title="t.altitude">
        {{ heightLabel }}
        <span class="chev" aria-hidden="true">▾</span>
      </button>
      <div class="pair">
        <button class="chip" type="button">
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="2" y="7" width="12" height="2" rx="1"/><rect x="2" y="11" width="12" height="2" rx="1"/></svg>
          {{ t.layers }}
        </button>
        <button class="chip" type="button">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor"/><path d="M8 4.8v3.4l2.2 1.2" fill="none" stroke="currentColor"/></svg>
          {{ t.hours }}
        </button>
      </div>
      <button v-if="ui.page === 'regional'" class="chip" type="button" @click="ui.uploadOpen = true">{{ t.upload }}</button>
      <button class="chip" type="button" @click="download">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v7M5 8l3 3 3-3M3.5 13h9" fill="none" stroke="currentColor"/></svg>
        {{ t.export }}
      </button>
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
  color: #111;
  font-size: 13px;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.35);
}
.row.on {
  background: #111;
  color: #fff;
  text-shadow: none;
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
  background: rgba(255, 255, 255, 0.92);
  color: #111;
  font-size: 12px;
  box-shadow: var(--shadow-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip.on {
  background: #111;
  color: #fff;
}
.chip svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.chip svg rect {
  fill: currentColor;
  stroke: none;
}
.chev {
  font-size: 10px;
  opacity: 0.7;
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
