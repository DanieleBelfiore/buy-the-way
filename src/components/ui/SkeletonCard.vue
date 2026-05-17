<script setup lang="ts">
withDefaults(
  defineProps<{ heightClass?: string }>(),
  { heightClass: 'h-14' },
);
</script>

<template>
  <div
    :class="['bg-offwhite rounded-2xl animate-pulse', heightClass]"
    aria-hidden="true"
    data-testid="skeleton-card"
  />
</template>
