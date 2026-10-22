<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'

const ui = useUiStore()
const field = useFieldStore()
const t = useT()

const cities = [
  { name: '北京', c: [116.4, 39.9] as [number, number] },
  { name: '上海', c: [121.5, 31.2] as [number, number] },
  { name: '广州', c: [113.3, 23.1] as [number, number] },
  { name: '深圳', c: [114.1, 22.5] as [number, number] },
  { name: '成都', c: [104.1, 30.7] as [number, number] },
  { name: '武汉', c: [114.3, 30.6] as [number, number] },
  { name: '西安', c: [108.9, 34.3] as [number, number] },
  { name: '南京', c: [118.8, 32.1] as [number, number] },
  { name: '杭州', c: [120.2, 30.3] as [number, number] },
  { name: '青岛', c: [120.4, 36.1] as [number, number] },
  { name: '厦门', c: [118.1, 24.5] as [number, number] },
  { name: '海口', c: [110.3, 20.0] as [number, number] },
  { name: '哈尔滨', c: [126.5, 45.8] as [number, number] },
  { name: '昆明', c: [102.8, 25.0] as [number, number] },
  { name: '乌鲁木齐', c: [87.6, 43.8] as [number, number] },
]

function pick(city: (typeof cities)[number]) {
  ui.selectedCity = city.name
  mapRuntime.map?.easeTo({ center: city.c, zoom: 5.4, duration: 700 })
}

async function bindWindFog() {
  ui.overlay = 'none'
  await field.ensurePack('forecast/china')
  mapRuntime.particles?.setStyle('wind-fog')
  mapRuntime.particles?.setOverlay('none')
  mapRuntime.resume()
}
</script>

<template>
  <div class="overlay">
    <aside class="glass left">
      <p class="panel-title">{{ t.cities }}</p>
      <p class="hint">{{ t.cityHint }}</p>
      <ul>
        <li v-for="c in cities" :key="c.name">
          <button type="button" :class="{ on: ui.selectedCity === c.name }" @click="pick(c)">
            {{ c.name }}
          </button>
        </li>
      </ul>
    </aside>
    <aside class="glass right">
      <p class="panel-title">{{ t.layers }}</p>
      <button class="btn-ghost active" type="button" @click="bindWindFog">{{ t.windFog }}</button>
      <p class="muted" style="margin-top: 12px">{{ t.livePlaceholder }}</p>
      <p class="src">
        <span class="dot" />
        forecast/china · {{ field.frame?.nx }}×{{ field.frame?.ny }}
      </p>
    </aside>
  </div>
</template>

<style scoped>
.left,
.right {
  position: absolute;
  top: 12px;
  width: var(--side);
  padding: 14px;
  max-height: calc(100% - 110px);
  overflow: auto;
}
.left {
  left: 12px;
}
.right {
  right: 12px;
}
.hint {
  font-size: 12px;
  color: var(--ink-subtle);
  margin: 0 0 8px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li button {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  color: var(--ink);
}
li button.on {
  color: var(--on-primary);
  background: var(--primary);
  font-weight: 600;
}
.src {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--ink-muted);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: var(--semantic-ok);
}
</style>
