<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Item } from '@/domain/types';

const { t } = useI18n();
const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ 'toggle-checked': [boolean]; remove: [] }>();
</script>

<template>
  <div class="flex items-center min-h-[44px]">
    <button
      data-testid="row-toggle"
      type="button"
      class="flex-1 flex items-center gap-3 px-5 min-h-[44px] text-left"
      :aria-label="props.item.checked ? t('item.markAsToBuy') : t('item.markAsBought')"
      @click="emit('toggle-checked', !props.item.checked)"
    >
      <span
        :class="[
          'flex-1 text-sm',
          props.item.checked ? 'line-through text-ink-40' : 'text-charcoal',
        ]"
      >
        {{ props.item.name }}
      </span>
      <span v-if="props.item.quantity" class="text-xs text-muted-gray">
        {{ props.item.quantity }}
      </span>
    </button>
    <button
      data-testid="row-remove"
      type="button"
      class="flex items-center justify-center w-11 h-11 mr-2 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
      :aria-label="t('item.remove')"
      @click="emit('remove')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  </div>
</template>
