<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useUiStore, type PageId } from '@/stores/ui'
import { useT } from '@/i18n'
import Logo from './Logo.vue'

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
    <div class="brand">
      <Logo />
      <span class="name">{{ t.brand }}</span>
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
    <div class="right">
      <button class="lang" type="button" @click="ui.toggleLocale()">
        <span :class="{ on: ui.locale === 'zh' }">{{ t.langZh }}</span>
        <span class="sep">/</span>
        <span :class="{ on: ui.locale === 'en' }">{{ t.langEn }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.nav {
  height: var(--nav-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: var(--map-veil);
  border-bottom: 1px solid var(--panel-border);
  z-index: 5;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}
.name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: center;
}
.tab {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  color: var(--ink-muted);
  font-size: 14px;
}
.tab:hover {
  color: var(--ink);
}
.tab.active {
  color: var(--on-primary);
  background: var(--primary);
  font-weight: 600;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
  justify-content: flex-end;
}
.lang {
  font-size: 12px;
  color: var(--ink-subtle);
}
.lang .on {
  color: var(--primary);
}
.sep {
  margin: 0 4px;
  color: var(--ink-subtle);
}
@media (max-width: 720px) {
  .name {
    display: none;
  }
  .brand,
  .right {
    min-width: 0;
  }
  .tab {
    padding: 0 8px;
    font-size: 13px;
  }
}
</style>
