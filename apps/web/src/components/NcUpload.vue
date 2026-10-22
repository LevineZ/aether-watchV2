<script setup lang="ts">
import { ref } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const t = useT()
const dragging = ref(false)
const input = ref<HTMLInputElement | null>(null)

const bbox: [number, number, number, number] = [117.5, 22, 131.5, 35]

async function handleFile(file: File | undefined) {
  if (!file) return
  mapRuntime.pause()
  await field.uploadNc(file, bbox)
  mapRuntime.resume()
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  void handleFile(f)
}

async function useSample() {
  const res = await fetch('/demo/sample-currents.nc')
  const buf = await res.blob()
  const file = new File([buf], 'sample-currents.nc', { type: 'application/x-netcdf' })
  void handleFile(file)
}
</script>

<template>
  <div>
    <p class="panel-title">{{ t.ncTitle }}</p>
    <p class="hint">{{ t.ncHint }}</p>
    <div
      class="drop"
      :class="{ on: dragging }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
      @click="input?.click()"
    >
      {{ t.ncPick }} · .nc
      <input ref="input" type="file" accept=".nc,.nc3,.cdf" hidden @change="handleFile(($event.target as HTMLInputElement).files?.[0])" />
    </div>
    <p v-if="field.ncStatus && field.ncStatus !== 'done'" class="muted">{{ t.ncParsing }}</p>
    <p v-else-if="field.uploaded" class="ok">{{ t.ncOk }}</p>
    <p v-else class="subtle">{{ t.emptyNc }}</p>
    <p v-if="field.ncError" class="err">{{ field.ncError }}</p>
    <div class="row">
      <button class="btn-ghost" type="button" @click="useSample">{{ t.sample }}</button>
      <button v-if="field.uploaded" class="btn-ghost" type="button" @click="field.clearUpload()">demo</button>
    </div>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--ink-muted);
  line-height: 1.45;
}
.drop {
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-md);
  padding: 14px 10px;
  text-align: center;
  color: var(--primary);
  font-size: 13px;
  margin-bottom: 8px;
}
.drop.on {
  background: rgba(90, 200, 230, 0.08);
}
.ok {
  color: var(--semantic-ok);
  font-size: 12px;
  margin: 0 0 6px;
}
.err {
  color: var(--semantic-danger);
  font-size: 12px;
  margin: 0 0 6px;
  line-height: 1.4;
}
.row {
  display: flex;
  gap: 8px;
}
.subtle,
.muted {
  font-size: 12px;
  margin: 0 0 8px;
}
</style>
