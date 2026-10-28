<script setup lang="ts">
import { computed } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()

const hours = [-24, -18, -12, -6, 0, 6, 12, 18, 24]

const dateLabel = computed(() => {
  const raw = field.frame?.time
  if (!raw) return t.value.singleFrameShort
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return t.value.singleFrameShort
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${t.value.today}, ${y}/${m}/${day}`
})

const packLabel = computed(() => {
  const nx = field.frame?.nx
  const ny = field.frame?.ny
  if (!nx || !ny) return t.value.sourceDemo
  return `${field.activePack || t.value.sourceDemo} · ${nx}×${ny}`
})

function label(h: number) {
  if (h === 0) return '00h'
  return `${h > 0 ? '+' : ''}${h}h`
}

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
</script>

<template>
  <footer class="tl">
    <button class="play" type="button" disabled :title="t.singleFrame">▶</button>
    <button class="date" type="button" disabled>{{ dateLabel }}</button>
    <div class="axis" role="slider" aria-valuenow="0" :aria-label="ui.page === 'desk' ? t.deskAxis : t.singleFrame">
      <button v-for="h in hours" :key="h" class="tick" :class="{ on: h === 0 }" type="button" disabled>
        {{ label(h) }}
      </button>
    </div>
    <p class="src">{{ packLabel }}</p>
    <button class="dl" type="button" @click="download">{{ t.download }}</button>
  </footer>
</template>

<style scoped>
.tl {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  height: var(--timeline-h);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--map-veil);
  border-top: 1px solid var(--panel-border);
}
.play,
.date,
.dl {
  height: 32px;
  padding: 0 10px;
  background: rgba(232, 241, 248, 0.06);
  color: var(--ink);
  font-size: 12px;
  flex: 0 0 auto;
}
.play {
  width: 36px;
  padding: 0;
}
.play:disabled,
.date:disabled,
.tick:disabled {
  cursor: default;
  opacity: 1;
}
.axis {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 28px;
  border-bottom: 2px solid rgba(90, 200, 230, 0.35);
  padding: 0 2px 3px;
}
.tick {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-subtle);
  padding: 0;
}
.tick.on {
  color: var(--primary);
  font-weight: 700;
}
.src {
  margin: 0;
  font-size: 11px;
  color: var(--ink-subtle);
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 720px) {
  .date,
  .src {
    display: none;
  }
}
</style>
