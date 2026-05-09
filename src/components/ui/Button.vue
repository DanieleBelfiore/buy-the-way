<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'dark' | 'accent' | 'ghost' | 'cream';

interface Props {
  variant?: Variant;
  full?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'dark',
  full: false,
  disabled: false,
});

const classes = computed((): readonly string[] => {
  const list: string[] = ['btn', `btn--${props.variant}`];
  if (props.full) list.push('btn--full');
  return list;
});
</script>

<template>
  <button
    type="button"
    :class="classes"
    :disabled="props.disabled || undefined"
    :aria-disabled="props.disabled || undefined"
  >
    <slot />
  </button>
</template>
