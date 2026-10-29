<script setup lang="ts">
/** Regional stage = NC View (owner-approved). FieldFrame upload path bypassed. */
</script>

<template>
  <iframe
    class="ncview-frame"
    src="/ncview/"
    title="区域场 · NC View"
    allow="clipboard-read; clipboard-write"
  />
</template>

<style scoped>
.ncview-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #0a1628;
  z-index: 1;
}
</style>
