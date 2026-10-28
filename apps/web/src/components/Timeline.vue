<script setup lang="ts">
import { computed } from 'vue'
import { useT } from '@/i18n'
import { useUiStore } from '@/stores/ui'

const t = useT()
const ui = useUiStore()

const dateLabel = computed(() => `${t.value.today} · 10/27`)
const thick = computed(() => ui.page === 'desk')
const live = computed(() => ui.page === 'desk')

function togglePlay() {
  if (!live.value) return
  ui.playing = !ui.playing
}
</script>

<template>
  <footer class="tl" :class="{ thick, dim: !live }">
    <button class="round" type="button" :disabled="!live" aria-label="prev">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 4v12M15 5v10L8 10z" />
      </svg>
    </button>
    <button class="round" type="button" :disabled="!live" :title="live ? t.play : t.noTimes" @click="togglePlay">
      <svg v-if="!ui.playing" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 4.5v11l9-5.5z" />
      </svg>
      <svg v-else viewBox="0 0 20 20" aria-hidden="true">
        <rect x="6" y="5" width="3" height="10" rx="0.6" />
        <rect x="11" y="5" width="3" height="10" rx="0.6" />
      </svg>
    </button>
    <button class="date pill" type="button" disabled>{{ live ? dateLabel : t.noTimes }}</button>
    <div class="axis" role="slider" aria-valuenow="0" :aria-label="live ? t.deskAxis : t.noTimes">
      <span class="line" />
      <span class="knob" />
    </div>
  </footer>
</template>

<style scoped>
.tl {
  position: absolute;
  left: 16px;
  right: 72px;
  bottom: 16px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.tl > * {
  pointer-events: auto;
}
.tl.dim {
  opacity: 0.42;
}
.tl.thick .round {
  width: 48px;
  height: 48px;
}
.tl.thick .date {
  height: 48px;
}
.tl.thick .axis {
  height: 48px;
}
.tl.thick .line {
  height: 4px;
}
.round {
  width: 40px;
  height: 40px;
  border-radius: 99px;
  background: var(--chrome);
  color: var(--chrome-ink);
  border: 1px solid var(--panel-border);
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.round:disabled {
  cursor: default;
}
.round svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.date {
  height: 40px;
  padding: 0 14px;
  font-size: 13px;
}
.axis {
  position: relative;
  flex: 1;
  height: 40px;
}
.line {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 2px;
  background: rgba(255, 255, 255, 0.28);
  transform: translateY(-50%);
  border-radius: 99px;
}
.knob {
  position: absolute;
  left: 42%;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border-radius: 99px;
  background: var(--primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}
</style>
