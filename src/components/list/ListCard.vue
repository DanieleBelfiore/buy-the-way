<script setup lang="ts">
import type { List } from '@/domain/types';

const props = defineProps<{ list: List }>();
const emit = defineEmits<{ (e: 'open', id: string): void }>();
</script>

<template>
  <button
    class="w-full text-left px-4 py-4 bg-offwhite rounded-2xl
           border border-cream-soft
           active:scale-95 transition-transform
           flex items-center justify-between gap-3"
    :aria-label="props.list.name"
    @click="emit('open', props.list.id)"
  >
    <span class="font-medium text-charcoal truncate">{{ props.list.name }}</span>
    <svg
      class="shrink-0 text-muted-gray"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
