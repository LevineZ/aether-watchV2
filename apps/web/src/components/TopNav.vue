<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore, type PageId } from '@/stores/ui'
import { useT } from '@/i18n'
import { mapRuntime } from '@/map/runtime'
import Logo from './Logo.vue'

const router = useRouter()
const route = useRoute()
const ui = useUiStore()
const t = useT()
const q = ref('')
const open = ref(false)
let blurTimer = 0

function onSearchFocus() {
  window.clearTimeout(blurTimer)
  open.value = true
}

function onSearchBlur() {
  blurTimer = window.setTimeout(() => {
    open.value = false
  }, 160)
}

const tabs: { id: PageId; to: string; key: 'tabGlobal' | 'tabDesk' | 'tabRegional' | 'tabAbout' }[] = [
  { id: 'global', to: '/global', key: 'tabGlobal' },
  { id: 'desk', to: '/desk', key: 'tabDesk' },
  { id: 'regional', to: '/regional', key: 'tabRegional' },
  { id: 'about', to: '/about', key: 'tabAbout' },
]

const places = computed(() => {
  if (ui.page === 'desk') {
    return [
      { name: '北京', c: [116.4, 39.9] as [number, number], z: 5.4 },
      { name: '上海', c: [121.5, 31.2] as [number, number], z: 5.6 },
      { name: '广州', c: [113.3, 23.1] as [number, number], z: 5.6 },
      { name: '深圳', c: [114.1, 22.5] as [number, number], z: 5.8 },
      { name: '成都', c: [104.1, 30.7] as [number, number], z: 5.5 },
      { name: '武汉', c: [114.3, 30.6] as [number, number], z: 5.5 },
      { name: '西安', c: [108.9, 34.3] as [number, number], z: 5.5 },
      { name: '南京', c: [118.8, 32.1] as [number, number], z: 5.6 },
      { name: '杭州', c: [120.2, 30.3] as [number, number], z: 5.6 },
      { name: '青岛', c: [120.4, 36.1] as [number, number], z: 5.6 },
      { name: '厦门', c: [118.1, 24.5] as [number, number], z: 5.7 },
      { name: '海口', c: [110.3, 20.0] as [number, number], z: 5.7 },
      { name: '哈尔滨', c: [126.5, 45.8] as [number, number], z: 5.3 },
      { name: '昆明', c: [102.8, 25.0] as [number, number], z: 5.5 },
      { name: '乌鲁木齐', c: [87.6, 43.8] as [number, number], z: 5.2 },
    ]
  }
  if (ui.page === 'regional') {
    return [
      { name: '上海', c: [121.5, 31.2] as [number, number], z: 6.6 },
      { name: '杭州', c: [120.2, 30.3] as [number, number], z: 6.6 },
      { name: '宁波', c: [121.6, 29.9] as [number, number], z: 6.8 },
      { name: '温州', c: [120.7, 28.0] as [number, number], z: 6.6 },
      { name: '福州', c: [119.3, 26.1] as [number, number], z: 6.5 },
      { name: '东海', c: [124.5, 28.5] as [number, number], z: 5.8 },
    ]
  }
  return [
    { name: t.value.pacific, c: [-150, 10] as [number, number], z: 2.1 },
    { name: t.value.atlantic, c: [-40, 35] as [number, number], z: 2.4 },
    { name: t.value.indian, c: [70, 0] as [number, number], z: 2.3 },
    { name: t.value.chinaSea, c: [124, 28] as [number, number], z: 4.2 },
    { name: t.value.indonesia, c: [118, -2] as [number, number], z: 3.8 },
    { name: t.value.gulf, c: [-90, 25] as [number, number], z: 3.6 },
  ]
})

const hits = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return places.value
  return places.value.filter((p) => p.name.toLowerCase().includes(s))
})

function go(to: string) {
  if (route.path === to) return
  void router.push(to)
}

function fly(place: (typeof places.value)[number]) {
  if (ui.page === 'desk') ui.selectedCity = place.name
  mapRuntime.map?.easeTo({ center: place.c, zoom: place.z, duration: 700 })
  q.value = place.name
  open.value = false
}
</script>

<template>
  <header class="nav">
    <div class="brand">
      <Logo />
      <span class="name">{{ t.brand }}</span>
    </div>
    <div class="search" v-if="ui.page !== 'about'">
      <input
        v-model="q"
        :placeholder="t.searchPlaceholder"
        @focus="onSearchFocus"
        @blur="onSearchBlur"
        @keydown.enter="hits[0] && fly(hits[0])"
      />
      <ul v-if="open && hits.length" class="hits">
        <li v-for="p in hits" :key="p.name">
          <button type="button" @mousedown.prevent="fly(p)">{{ p.name }}</button>
        </li>
      </ul>
    </div>
    <nav class="tabs" aria-label="pages">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: ui.page === tab.id }"
        type="button"
        @click="go(tab.to)"
      >
        {{ t[tab.key] }}
      </button>
    </nav>
    <button class="lang" type="button" @click="ui.toggleLocale()">
      <span :class="{ on: ui.locale === 'zh' }">{{ t.langZh }}</span>
      <span class="sep">/</span>
      <span :class="{ on: ui.locale === 'en' }">{{ t.langEn }}</span>
    </button>
  </header>
</template>

<style scoped>
.nav {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.nav > * {
  pointer-events: auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px 0 8px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.name {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.search {
  position: relative;
  flex: 0 1 280px;
}
.search input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.hits {
  position: absolute;
  left: 0;
  right: 0;
  top: 42px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
  max-height: 280px;
  overflow: auto;
}
.hits button {
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  color: var(--ink);
  font-size: 13px;
}
.hits button:hover {
  background: rgba(90, 200, 230, 0.12);
}
.tabs {
  display: flex;
  gap: 2px;
  margin-left: auto;
  height: 40px;
  padding: 3px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.tab {
  height: 100%;
  padding: 0 12px;
  color: var(--ink-muted);
  font-size: 13px;
}
.tab:hover {
  color: var(--ink);
}
.tab.active {
  color: var(--on-primary);
  background: var(--primary);
  font-weight: 600;
}
.lang {
  height: 40px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--ink-subtle);
  background: var(--panel);
  border: 1px solid var(--panel-border);
  box-shadow: var(--shadow-float);
}
.lang .on {
  color: var(--primary);
}
.sep {
  margin: 0 4px;
}
@media (max-width: 860px) {
  .name,
  .search {
    display: none;
  }
  .tab {
    padding: 0 8px;
    font-size: 12px;
  }
}
</style>
