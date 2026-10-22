<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useT } from '@/i18n'
import Logo from '@/components/Logo.vue'

const t = useT()
const router = useRouter()
const cards = [
  { to: '/global', titleKey: 'tabGlobal' as const, bodyKey: 'windFog' as const },
  { to: '/desk', titleKey: 'tabDesk' as const, bodyKey: 'windFog' as const },
  { to: '/regional', titleKey: 'tabRegional' as const, bodyKey: 'currents' as const },
]
</script>

<template>
  <div class="overlay about">
    <div class="hero glass">
      <div class="head">
        <Logo />
        <h1>{{ t.brand }}</h1>
      </div>
      <p class="lead">{{ t.aboutTitle }}</p>
      <p class="muted">{{ t.aboutLead }}</p>
      <div class="cards">
        <button v-for="c in cards" :key="c.to" class="card" type="button" @click="router.push(c.to)">
          <h2>{{ t[c.titleKey] }}</h2>
          <p>{{ t[c.bodyKey] }}</p>
        </button>
      </div>
      <button class="btn-primary cta" type="button" @click="router.push('/global')">{{ t.aboutCta }}</button>
      <p class="foot">{{ t.aboutFoot }}</p>
      <p class="foot">{{ t.aboutBasemap }}</p>
    </div>
  </div>
</template>

<style scoped>
.about {
  background: rgba(10, 22, 40, 0.72);
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.hero {
  max-width: 860px;
  width: 100%;
  padding: 28px 28px 20px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 28px;
}
.lead {
  font-size: 18px;
  margin: 12px 0 6px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 18px 0;
}
.card {
  text-align: left;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--panel-border);
  background: rgba(10, 22, 40, 0.35);
}
.card h2 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--primary);
}
.card p {
  margin: 0;
  color: var(--ink-muted);
}
.cta {
  margin-top: 4px;
}
.foot {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--ink-subtle);
}
@media (max-width: 720px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
