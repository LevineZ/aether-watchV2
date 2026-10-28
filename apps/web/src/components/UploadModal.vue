<script setup lang="ts">
import { ref } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useUiStore } from '@/stores/ui'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const field = useFieldStore()
const ui = useUiStore()
const t = useT()
const input = ref<HTMLInputElement | null>(null)

async function handleFile(file: File | undefined) {
  if (!file) return
  mapRuntime.pause()
  await field.uploadNc(file)
  mapRuntime.resume()
  if (field.uploaded) ui.uploadOpen = false
}

async function useSample() {
  const res = await fetch('/demo/sample-currents.nc')
  const buf = await res.blob()
  const file = new File([buf], 'sample-currents.nc', { type: 'application/x-netcdf' })
  await handleFile(file)
}
</script>

<template>
  <div class="mask" @click.self="ui.uploadOpen = false">
    <section class="card" role="dialog" aria-modal="true">
      <h2>{{ ui.regionalMode === 'inspect' ? t.ncviewTitle : t.uploadTitle }}</h2>
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
      <div class="row">
        <button class="btn-primary" type="button" @click="input?.click()">
          {{ ui.regionalMode === 'inspect' ? t.ncviewPick : t.ncPick }}
        </button>
        <button class="btn-ghost" type="button" @click="useSample">{{ t.loadSample }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mask {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 10, 12, 0.55);
}
.card {
  width: min(420px, calc(100vw - 32px));
  padding: 28px 28px 24px;
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
  margin: 0 0 12px;
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
.err {
  color: var(--semantic-danger);
}
</style>
