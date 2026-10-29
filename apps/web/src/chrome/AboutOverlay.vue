<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useT } from '@/i18n'
import Logo from '@/components/Logo.vue'

const t = useT()
const router = useRouter()
const cards = [
  { to: '/global', titleKey: 'tabGlobal' as const, bodyKey: 'aboutFeatGlobal' as const },
  { to: '/desk', titleKey: 'tabDesk' as const, bodyKey: 'aboutFeatDesk' as const },
  { to: '/regional', titleKey: 'tabRegional' as const, bodyKey: 'aboutFeatRegional' as const },
]
</script>

<template>
  <div class="overlay about">
    <div class="hero">
      <div class="head">
        <Logo />
        <h1>{{ t.brand }}</h1>
      </div>
      <p class="lead">{{ t.aboutTitle }}</p>
      <p class="muted">{{ t.aboutLead }}</p>
      <p class="panel-title feats-label">{{ t.aboutFeatures }}</p>
      <div class="cards">
        <button v-for="c in cards" :key="c.to" class="card" type="button" @click="router.push(c.to)">
          <h2>{{ t[c.titleKey] }}</h2>
          <p>{{ t[c.bodyKey] }}</p>
        </button>
      </div>
      <div class="notes">
        <p class="panel-title">{{ t.aboutNotesTitle }}</p>
        <p class="muted">{{ t.aboutNotes }}</p>
      </div>
      <button class="btn-primary cta" type="button" @click="router.push('/global')">{{ t.aboutCta }}</button>
      <p class="foot">{{ t.aboutFoot }}</p>
    </div>
  </div>
</template>

<style scoped>
.about {
  background: rgba(8, 10, 12, 0.45);
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.hero {
  max-width: 820px;
  width: 100%;
  padding: 28px 28px 22px;
  background: #fff;
  color: #111;
  border-radius: 28px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 26px;
}
.lead {
  font-size: 18px;
  margin: 12px 0 6px;
}
.muted,
.foot {
  color: #6b7280;
}
.feats-label,
.panel-title {
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 650;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 8px 0 16px;
}
.card {
  text-align: left;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: #f8fafc;
}
.card h2 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #111;
}
.card p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}
.notes {
  margin: 0 0 12px;
}
.cta {
  margin-top: 4px;
}
.foot {
  margin: 16px 0 0;
  font-size: 12px;
}
@media (max-width: 720px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
