<script setup lang="ts">
interface Props {
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
});
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="btw-mark"
  >
    <rect
      x="2"
      y="3"
      width="28"
      height="26"
      rx="6"
      fill="var(--charcoal)"
    />
    <path
      d="M10 8.5h8.4c2.4 0 4.1 1.5 4.1 3.7 0 1.5-.8 2.6-2 3.2 1.6.5 2.7 1.8 2.7 3.7 0 2.5-1.9 4.4-4.7 4.4H10V8.5Zm3 5.9h4.7c1 0 1.7-.6 1.7-1.5s-.7-1.5-1.7-1.5H13v3Zm0 6.3h5c1.2 0 2-.7 2-1.7 0-1-.8-1.7-2-1.7h-5v3.4Z"
      fill="var(--cream)"
    />
  </svg>
</template>

<style scoped>
.btw-mark {
  display: inline-block;
  flex-shrink: 0;
}
</style>
