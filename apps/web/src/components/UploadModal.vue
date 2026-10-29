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
const bbox: [number, number, number, number] = [117.5, 22, 131.5, 35]

async function handleFile(file: File | undefined) {
  if (!file) return
  mapRuntime.pause()
  await field.uploadNc(file, bbox)
  mapRuntime.resume()
  ui.uploadOpen = false
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
      <h2>{{ t.uploadTitle }}</h2>
      <p>{{ t.uploadLead }}</p>
      <input ref="input" type="file" accept=".nc,.nc3,.cdf" hidden @change="handleFile(($event.target as HTMLInputElement).files?.[0])" />
      <p v-if="field.ncError" class="err">{{ field.ncError }}</p>
      <div class="row">
        <button class="btn-primary" type="button" @click="input?.click()">{{ t.ncPick }}</button>
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
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
  text-align: center;
}
h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
p {
  margin: 0 0 18px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}
.row {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.err {
  color: #b91c1c;
}
</style>
