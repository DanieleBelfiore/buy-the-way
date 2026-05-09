<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'default' | 'cream' | 'dark';

interface Props {
  variant?: Variant;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
});

const classes = computed((): readonly string[] => {
  const list: string[] = ['chip'];
  if (props.variant !== 'default') list.push(`chip--${props.variant}`);
  return list;
});
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
