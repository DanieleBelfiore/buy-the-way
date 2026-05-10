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
    <line
      x1="18"
      y1="6"
      x2="6"
      y2="18"
    /><line
      x1="6"
      y1="6"
      x2="18"
      y2="18"
    />
  </svg>
</template>
