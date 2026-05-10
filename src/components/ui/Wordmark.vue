<script setup lang="ts">
import { computed } from 'vue';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  size?: Size;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const svgHeight = computed(() => {
  switch (props.size) {
    case 'sm': return '18px';
    case 'lg': return '36px';
    default:   return '24px';
  }
});
</script>

<template>
  <svg
    viewBox="0 0 192 32"
    fill="currentColor"
    :style="{ height: svgHeight, width: 'auto' }"
    role="img"
    aria-label="Buy The Way"
    class="wordmark"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill-rule="evenodd"
      d="M8 3h16a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6zm2 5.5h8.4c2.4 0 4.1 1.5 4.1 3.7 0 1.5-.8 2.6-2 3.2 1.6.5 2.7 1.8 2.7 3.7 0 2.5-1.9 4.4-4.7 4.4H10V8.5Z"
    />
    <text
      x="40"
      y="23"
      font-family="system-ui,-apple-system,'Segoe UI',sans-serif"
      font-weight="600"
      font-size="18"
      letter-spacing="0.02em"
    >Buy The Way</text>
  </svg>
</template>

<style scoped>
.wordmark {
  display: inline-block;
  flex-shrink: 0;
}
</style>
