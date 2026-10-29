<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useUiStore, type PageId } from '@/stores/ui'
import { useT } from '@/i18n'

const router = useRouter()
const route = useRoute()
const ui = useUiStore()
const t = useT()

const tabs: { id: PageId; to: string; key: 'tabGlobal' | 'tabDesk' | 'tabRegional' | 'tabAbout' }[] = [
  { id: 'global', to: '/global', key: 'tabGlobal' },
  { id: 'desk', to: '/desk', key: 'tabDesk' },
  { id: 'regional', to: '/regional', key: 'tabRegional' },
  { id: 'about', to: '/about', key: 'tabAbout' },
]

function go(to: string) {
  if (route.path === to) return
  void router.push(to)
}

function onSettings() {
  // Regional is NC View — do not open FieldFrame upload modal.
}
</script>

<template>
  <header class="nav">
    <div class="brand pill">
      <span class="name">{{ t.brand }}</span>
      <span class="ver">v0.11</span>
      <nav class="tabs" aria-label="pages">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ on: ui.page === tab.id }"
          type="button"
          @click="go(tab.to)"
        >
          {{ t[tab.key] }}
        </button>
      </nav>
    </div>
    <div class="right">
      <button class="round pill" type="button" @click="ui.toggleLocale()">{{ t.langZh }}</button>
      <button class="round pill" type="button" :title="t.settings" @click="onSettings">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="2.2" />
          <path d="M10 3.4v1.6M10 15v1.6M3.4 10h1.6M15 10h1.6M5.4 5.4l1.1 1.1M13.5 13.5l1.1 1.1M5.4 14.6l1.1-1.1M13.5 6.5l1.1-1.1" />
        </svg>
      </button>
      <button class="round pill show" type="button" :title="t.display" @click="ui.toggleLabels()">
        <span class="live" :class="{ off: !ui.labelsOn }" />
        {{ t.display }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: absolute;
  top: 14px;
  left: 16px;
  right: 16px;
  z-index: 6;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  padding: 3px 4px 3px 14px;
}
.name {
  font-size: 14px;
  font-weight: 650;
}
.ver {
  font-size: 11px;
  color: var(--chrome-muted);
  margin-right: 4px;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tab {
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  color: var(--chrome-muted);
  font-size: 13px;
}
.tab.on {
  background: #111;
  color: #fff;
  font-weight: 600;
}
.right {
  display: flex;
  gap: 8px;
}
.round {
  height: 40px;
  min-width: 40px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.round svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: #111;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.show {
  gap: 6px;
}
.live {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: #22c55e;
}
.live.off {
  background: #d1d5db;
}
@media (max-width: 720px) {
  .ver,
  .show {
    display: none;
  }
  .tab {
    padding: 0 8px;
    font-size: 12px;
  }
}
</style>
