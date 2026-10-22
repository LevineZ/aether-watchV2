<script setup lang="ts">
defineProps<{ values: number[] }>()
</script>

<template>
  <svg viewBox="0 0 120 36" class="spark" aria-hidden="true">
    <polyline
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
      stroke-linecap="round"
      :points="
        values
          .map((v, i) => {
            const x = (i / Math.max(values.length - 1, 1)) * 120
            const y = 32 - v * 28
            return `${x},${y}`
          })
          .join(' ')
      "
    />
  </svg>
</template>

<style scoped>
.spark {
  width: 100%;
  height: 36px;
  color: var(--primary);
  display: block;
}
</style>
