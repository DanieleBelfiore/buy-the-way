<script setup lang="ts">
interface Props {
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
});
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5l-5 5-5-5M17 19l-5-5-5 5"/><path d="M2 12l5-5 5 5-5 5-5-5zM22 12l-5-5-5 5 5 5 5-5z"/>
  </svg>
</template>
