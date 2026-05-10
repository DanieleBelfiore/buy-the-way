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
    <path d="M9 2h6v3l2 3v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8L9 5V2z" /><line
      x1="9"
      y1="11"
      x2="15"
      y2="11"
    />
  </svg>
</template>
