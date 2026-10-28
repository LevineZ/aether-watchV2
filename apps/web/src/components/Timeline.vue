<script setup lang="ts">
import { computed } from 'vue'
import { useFieldStore } from '@/stores/field'
import { useT } from '@/i18n'

const field = useFieldStore()
const t = useT()

const dateLabel = computed(() => {
  const raw = field.frame?.time
  const d = raw ? new Date(raw) : new Date('2026-10-27T00:00:00Z')
  if (Number.isNaN(d.getTime())) return t.value.today
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${t.value.today} · ${m}/${day}`
})
</script>

<template>
  <footer class="tl">
    <button class="round" type="button" disabled aria-label="prev">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 4v12M15 5v10L8 10z" />
      </svg>
    </button>
    <button class="round" type="button" disabled :title="t.singleFrame">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 4.5v11l9-5.5z" />
      </svg>
    </button>
    <button class="date pill" type="button" disabled>{{ dateLabel }}</button>
    <div class="axis" role="slider" aria-valuenow="0" :aria-label="t.deskAxis">
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
.round {
  width: 40px;
  height: 40px;
  border-radius: 99px;
  background: #111;
  color: #fff;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.round:disabled {
  opacity: 1;
  cursor: default;
}
.round svg {
  width: 16px;
  height: 16px;
  fill: #fff;
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
  background: rgba(255, 255, 255, 0.88);
  transform: translateY(-50%);
}
.knob {
  position: absolute;
  left: 42%;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border-radius: 99px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
</style>
