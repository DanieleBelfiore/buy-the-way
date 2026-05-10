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
    <path d="M12 2C10.5 2 9 3 9 3C9 3 7 2 5.5 3.5C4 5 4.5 7 5 8C4 9 3 11 3 13C3 16 5 20 8 21C9 22 10 22 12 22C14 22 15 22 16 21C19 20 21 16 21 13C21 11 20 9 19 8C19.5 7 20 5 18.5 3.5C17 2 15 3 15 3C15 3 13.5 2 12 2Z" />
  </svg>
</template>
