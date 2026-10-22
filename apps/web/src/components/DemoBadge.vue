<script setup lang="ts">
import { useT } from '@/i18n'
const t = useT()
</script>

<template>
  <span class="badge">{{ t.demoBadge }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--panel-border);
  background: rgba(19, 36, 59, 0.8);
  color: var(--primary);
  font-size: 12px;
  letter-spacing: 0.04em;
}
</style>
