<script setup lang="ts">
import { computed } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const t = useT()

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
</script>

<template>
  <div class="tl glass">
    <p class="note">{{ t.singleFrame }}</p>
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
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--ink-muted);
}
.meta {
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .meta {
    display: none;
  }
}
</style>
