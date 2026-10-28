<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()
const input = ref<HTMLInputElement | null>(null)

const inspect = computed(() => ui.regionalMode === 'inspect')

async function handleFile(file: File | undefined) {
  if (!file) return
  mapRuntime.pause()
  await field.uploadNc(file)
  mapRuntime.resume()
}

async function useSample() {
  try {
    const res = await fetch('/demo/sample-currents.nc')
    if (res.ok) {
      const buf = await res.blob()
      const file = new File([buf], 'sample-currents.nc', { type: 'application/x-netcdf' })
      await handleFile(file)
      if (field.uploaded) return
    }
  } catch {
    /* fall through to JSON sample */
  }
  const res = await fetch('/demo/sample-field.json')
  const buf = await res.blob()
  const file = new File([buf], 'sample-field.json', { type: 'application/json' })
  await handleFile(file)
}

function toggleMode() {
  ui.regionalMode = inspect.value ? 'demo' : 'inspect'
}
</script>

<template>
  <div v-if="!field.uploaded" class="empty">
    <section class="card">
      <h2>{{ inspect ? t.ncviewTitle : t.uploadTitle }}</h2>
      <p>{{ t.uploadLead }}</p>
      <p class="fmt">{{ t.uploadFmt }}</p>
      <input
        ref="input"
        type="file"
        accept=".nc,.nc4,.nc3,.cdf,.json"
        hidden
        @change="handleFile(($event.target as HTMLInputElement).files?.[0])"
      />
      <p v-if="field.ncError" class="err">{{ field.ncError }}</p>
      <p v-else-if="field.ncStatus && field.ncStatus !== 'done'" class="muted">{{ t.ncParsing }}</p>
      <div class="row">
        <button class="btn-primary" type="button" @click="input?.click()">
          {{ inspect ? t.ncviewPick : t.ncPick }}
        </button>
        <button class="btn-ghost" type="button" @click="useSample">{{ t.loadSample }}</button>
      </div>
      <button class="mode" type="button" @click="toggleMode">
        {{ inspect ? t.modeDemo : t.modeInspect }}
      </button>
    </section>
  </div>
  <div v-else class="summary">
    {{ field.uploadName }} · {{ field.frame?.kind }} · {{ field.frame?.time || t.noTimes }}
    <span v-if="field.frame?.meta.level"> · {{ field.frame?.meta.level }}</span>
  </div>
</template>

<style scoped>
.empty {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.card {
  pointer-events: auto;
  width: min(440px, calc(100vw - 32px));
  padding: 28px 28px 20px;
  border-radius: 20px;
  background: var(--panel);
  color: var(--chrome-ink);
  border: 1px solid var(--panel-border);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  text-align: center;
}
h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
p {
  margin: 0 0 10px;
  color: var(--chrome-muted);
  font-size: 13px;
  line-height: 1.5;
}
.fmt {
  font-size: 12px;
  margin-bottom: 18px;
}
.row {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.mode {
  margin-top: 14px;
  font-size: 12px;
  color: var(--chrome-muted);
}
.err {
  color: var(--semantic-danger);
}
.summary {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  height: 32px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  background: var(--chrome);
  color: var(--chrome-ink);
  border: 1px solid var(--panel-border);
  border-radius: 9999px;
  font-size: 12px;
  pointer-events: none;
  max-width: min(640px, calc(100vw - 280px));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
