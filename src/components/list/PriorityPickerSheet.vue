<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, CircleDashed, Flag, X } from '@lucide/vue';
import type { Item, ItemPriority } from '@/domain/types';

const props = defineProps<{
  open: boolean;
  item: Item | null;
}>();

const emit = defineEmits<{
  select: [ItemPriority | null];
  cancel: [];
}>();

const { t } = useI18n();
const titleId = useId();

const currentPriority = (): ItemPriority | null => props.item?.priority ?? null;

const onSelect = (p: ItemPriority | null): void => emit('select', p);
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
  >
    <div
      data-testid="priority-picker-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      class="relative z-10 w-full sm:max-w-md mx-0 sm:mx-5 rounded-t-2xl sm:rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="flex items-center justify-between mb-3">
        <h2 :id="titleId" class="inline-flex items-center gap-2 text-base font-semibold text-charcoal">
          <Flag :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.priority') }}
        </h2>
        <button
          data-testid="priority-picker-cancel"
          type="button"
          :aria-label="t('list.cancel')"
          class="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-gray hover:bg-black/5"
          @click="emit('cancel')"
        >
          <X :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>

      <p v-if="props.item" class="text-xs text-muted-gray mb-3">{{ props.item.name }}</p>

      <div role="radiogroup" :aria-label="t('item.priority')" class="space-y-2">
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-urgent"
          :aria-checked="currentPriority() === 'urgent'"
          :class="[
            'w-full inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left text-red-700',
            currentPriority() === 'urgent'
              ? 'border-red-600 bg-red-50'
              : 'border-cream-soft bg-offwhite hover:bg-red-50/60',
          ]"
          @click="onSelect('urgent')"
        >
          <AlertTriangle :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.priorityUrgent') }}
        </button>
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-none"
          :aria-checked="currentPriority() === null"
          :class="[
            'w-full inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left',
            currentPriority() === null
              ? 'border-charcoal bg-charcoal/5 text-charcoal'
              : 'border-cream-soft bg-offwhite text-charcoal hover:bg-cream',
          ]"
          @click="onSelect(null)"
        >
          <Flag :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.priorityNone') }}
        </button>
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-optional"
          :aria-checked="currentPriority() === 'optional'"
          :class="[
            'w-full inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors text-left text-muted-gray',
            currentPriority() === 'optional'
              ? 'border-muted-gray bg-cream'
              : 'border-cream-soft bg-offwhite hover:bg-cream',
          ]"
          @click="onSelect('optional')"
        >
          <CircleDashed :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.priorityOptional') }}
        </button>
      </div>
    </div>
  </div>
</template>
