<script setup lang="ts">
import { computed } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()

const hours = [-24, -12, -6, 0, 6, 12, 18, 24]

function download() {
  const frame = field.frame
  const blob = new Blob(
    [
      JSON.stringify(
        {
          note: '示例数据 · FieldFrame meta only',
          nx: frame?.nx,
          ny: frame?.ny,
          bbox: frame?.bbox,
          time: frame?.time,
          meta: frame?.meta,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'aether-field-meta.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

const lodLabel = computed(() => {
  const lod = mapRuntime.particles?.getLod() ?? 'peak'
  return lod === 'peak' ? '400k' : lod
})

function label(h: number) {
  if (h === 0) return '00h'
  return `${h > 0 ? '+' : ''}${h}h`
}
</script>

<template>
  <div class="tl glass">
    <p class="note">{{ t.singleFrame }}</p>
    <div v-if="ui.page === 'desk'" class="axis" role="slider" aria-valuenow="0" :aria-label="t.deskAxis">
      <button v-for="h in hours" :key="h" class="tick" :class="{ on: h === 0 }" type="button" disabled>
        {{ label(h) }}
      </button>
    </div>
    <div class="meta subtle">LOD {{ lodLabel }}</div>
    <button class="btn-ghost" type="button" @click="download">{{ t.download }}</button>
  </div>
</template>

<style scoped>
.tl {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  height: 76px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  z-index: 3;
}
.note {
  flex: 0 0 auto;
  margin: 0;
  font-size: 13px;
  color: var(--ink-muted);
  max-width: 220px;
}
.axis {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  height: 36px;
  border-bottom: 3px solid rgba(90, 200, 230, 0.28);
  padding: 0 4px 4px;
}
.tick {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--ink-subtle);
  padding: 0;
  cursor: default;
}
.tick.on {
  color: var(--primary);
  font-weight: 700;
  font-size: 12px;
}
.meta {
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .note {
    display: none;
  }
  .meta {
    display: none;
  }
}
</style>
