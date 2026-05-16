<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { List } from '@/domain/types';

const props = withDefaults(
  defineProps<{ list: List; isNew?: boolean }>(),
  { isNew: false },
);
const emit = defineEmits<{ (e: 'open', id: string): void }>();
const { t } = useI18n();
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
    <span class="flex items-center gap-2 min-w-0">
      <span class="font-medium text-charcoal truncate">{{ props.list.name }}</span>
      <span
        v-if="props.isNew"
        data-testid="new-badge"
        class="shrink-0 rounded-full bg-charcoal text-offwhite px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      >
        {{ t('badge.new') }}
      </span>
    </span>
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
