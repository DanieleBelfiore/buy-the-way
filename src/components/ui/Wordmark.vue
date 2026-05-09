<script setup lang="ts">
import { computed } from 'vue';
import BTWMark from './BTWMark.vue';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  size?: Size;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const markSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 18;
    case 'lg':
      return 36;
    default:
      return 24;
  }
});

const textSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'var(--text-sm)';
    case 'lg':
      return 'var(--text-lg)';
    default:
      return 'var(--text-md)';
  }
});
</script>

<template>
  <span class="wordmark wordmark--row" :style="{ fontSize: textSize }">
    <BTWMark :size="markSize" />
    <span class="wordmark__text">Buy The Way</span>
  </span>
</template>

<style scoped>
.wordmark--row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.wordmark__text {
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--charcoal);
  line-height: 1;
}
</style>
