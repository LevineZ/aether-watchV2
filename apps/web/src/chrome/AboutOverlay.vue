<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useT } from '@/i18n'
import Logo from '@/components/Logo.vue'

const t = useT()
const router = useRouter()
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
      <p class="muted">{{ t.aboutData }}</p>
      <p class="muted">{{ t.aboutWindy }}</p>
      <button class="btn-primary cta" type="button" @click="router.push('/global')">{{ t.aboutCta }}</button>
      <p class="foot">{{ t.aboutFoot }}</p>
    </div>
  </div>
</template>

<style scoped>
.about {
  background: rgba(8, 10, 12, 0.55);
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.hero {
  max-width: 640px;
  width: 100%;
  padding: 28px 28px 22px;
  background: var(--panel);
  color: var(--chrome-ink);
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
}
.lead {
  font-size: 16px;
  margin: 14px 0 10px;
  line-height: 1.55;
}
.muted,
.foot {
  color: var(--chrome-muted);
  line-height: 1.55;
  margin: 0 0 10px;
  font-size: 13px;
}
.cta {
  margin-top: 8px;
}
.foot {
  margin: 16px 0 0;
  font-size: 12px;
}
</style>
