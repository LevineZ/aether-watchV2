<script setup lang="ts">
import { useT } from '@/i18n'
const t = useT()
</script>

<template>
  <section class="glass card">
    <p class="panel-title">{{ t.radar }}</p>
    <div class="ring">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(90,200,230,0.12)" stroke-width="1" />
        <circle cx="80" cy="80" r="50" fill="none" stroke="rgba(90,200,230,0.18)" stroke-width="1" />
        <circle cx="80" cy="80" r="26" fill="none" stroke="rgba(90,200,230,0.28)" stroke-width="1.2" />
        <circle cx="80" cy="80" r="3" fill="#5ac8e6" />
        <path d="M80 80 L128 52" stroke="#5ac8e6" stroke-width="1.2" stroke-linecap="round" />
        <text x="118" y="24" fill="#7a9bb5" font-size="9">320km</text>
        <text x="96" y="58" fill="#4a6a82" font-size="8">160</text>
        <text x="86" y="72" fill="#4a6a82" font-size="8">80</text>
      </svg>
    </div>
    <p class="hint">{{ t.radarHint }}</p>
  </section>
</template>

<style scoped>
.card {
  width: 260px;
  padding: 12px 14px 10px;
}
.ring {
  display: flex;
  justify-content: center;
}
.ring svg {
  width: 160px;
  height: 160px;
}
.hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-subtle);
}
</style>
