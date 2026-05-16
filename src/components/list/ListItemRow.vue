<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Item } from '@/domain/types';

const { t } = useI18n();
const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ 'toggle-checked': [boolean] }>();
</script>

<template>
  <button
    class="w-full flex items-center gap-3 px-5 min-h-[44px] text-left"
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
</template>
