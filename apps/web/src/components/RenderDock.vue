<script setup lang="ts">
import { watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'
import NcUpload from './NcUpload.vue'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

watch(
  () => [ui.density, ui.pointSize, ui.strength, ui.overlay],
  () => {
    const p = mapRuntime.particles
    if (!p) return
    p.setSpeed(ui.strength)
    p.setDensity(ui.density)
    if (ui.overlay === 'none') {
      p.setSize(ui.pointSize * (ui.page === 'regional' ? 3.2 : 2.0))
    }
    p.setOverlay(ui.overlay)
    if (p.getLod() !== 'paused') p.setLod('peak')
  },
)

async function setOverlay(mode: 'none' | 'temp' | 'precip') {
  ui.overlay = mode
  const p = mapRuntime.particles
  if (mode === 'temp') {
    await field.ensurePack('regional/temp')
    p?.setOverlay('temp')
  } else if (mode === 'precip') {
    await field.ensurePack('regional/precip')
    p?.setOverlay('precip')
  } else {
    await field.showPage('regional')
    p?.setStyle('currents')
    p?.setOverlay('none')
  }
  p?.setLod('peak')
  mapRuntime.resume()
}
</script>

<template>
  <section class="glass dock">
    <p class="panel-title">{{ t.render }}</p>
    <label>
      {{ t.density }}
      <input v-model.number="ui.density" type="range" min="0.2" max="1" step="0.05" />
    </label>
    <label>
      {{ t.trail }}
      <input v-model.number="ui.pointSize" type="range" min="0.6" max="1.8" step="0.05" />
    </label>
    <label>
      {{ t.strength }}
      <input v-model.number="ui.strength" type="range" min="0.4" max="2" step="0.05" />
    </label>
    <div class="bar-wrap">
      <span>{{ t.weak }}</span>
      <div class="bar" />
      <span>{{ t.strong }}</span>
    </div>
    <div class="layers">
      <button class="btn-ghost" :class="{ active: ui.overlay === 'none' }" type="button" @click="setOverlay('none')">
        {{ t.currents }}
      </button>
      <button class="btn-ghost" :class="{ active: ui.overlay === 'temp' }" type="button" @click="setOverlay('temp')">
        {{ t.temp }}
      </button>
      <button class="btn-ghost" :class="{ active: ui.overlay === 'precip' }" type="button" @click="setOverlay('precip')">
        {{ t.precip }}
      </button>
    </div>
    <NcUpload />
  </section>
</template>

<style scoped>
.dock {
  width: 300px;
  padding: 12px 14px 14px;
  max-height: calc(100% - 110px);
  overflow: auto;
}
label {
  display: block;
  font-size: 12px;
  color: var(--ink-muted);
  margin-bottom: 10px;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--primary);
  margin-top: 4px;
}
.bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--ink-subtle);
  margin-bottom: 12px;
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 99px;
  background: linear-gradient(90deg, rgba(90, 200, 230, 0.15), #5ac8e6);
}
.layers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
</style>
