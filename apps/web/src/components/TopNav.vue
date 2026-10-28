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
</script>

<template>
  <header class="nav">
    <div class="brand pill">
      <span class="name">{{ t.brand }}</span>
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
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--chrome-ink);
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
  background: var(--pill-on);
  color: var(--pill-on-ink);
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
.show {
  gap: 6px;
}
.live {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: var(--semantic-ok);
}
.live.off {
  background: #4b5563;
}
@media (max-width: 720px) {
  .show {
    display: none;
  }
  .tab {
    padding: 0 8px;
    font-size: 12px;
  }
}
</style>
