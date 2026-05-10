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
    <path d="M3 3h4v4H3zM8 5h5M13 3v8h2l1 3H5l1-3h2" /><line
      x1="9"
      y1="20"
      x2="9"
      y2="16"
    /><line
      x1="13"
      y1="20"
      x2="13"
      y2="16"
    />
  </svg>
</template>
