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
    <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14H6L5,6" /><path d="M10,11v6M14,11v6" /><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6" />
  </svg>
</template>
