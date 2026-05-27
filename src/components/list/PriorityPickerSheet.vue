<script setup lang="ts">
import { useId, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { CircleDashed, Flag, Flame, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
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

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
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
      class="relative z-10 w-full sm:max-w-md mx-5 rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="mb-3 text-center">
        <h2 :id="titleId" class="inline-flex items-center justify-center gap-2 text-base font-semibold text-charcoal">
          <Flag :size="18" :stroke-width="2" aria-hidden="true" />
          {{ t('item.priority') }}
        </h2>
      </div>

      <div role="radiogroup" :aria-label="t('item.priority')" class="flex flex-row items-stretch gap-2">
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-optional"
          :aria-checked="currentPriority() === 'optional'"
          :class="[
            'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors text-center text-muted-gray',
            currentPriority() === 'optional'
              ? 'border-muted-gray bg-cream'
              : 'border-cream-soft bg-offwhite hover:bg-cream',
          ]"
          @click="onSelect('optional')"
        >
          <CircleDashed :size="20" :stroke-width="2" aria-hidden="true" />
          <span>{{ t('item.priorityOptional') }}</span>
        </button>
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-none"
          :aria-checked="currentPriority() === null"
          :class="[
            'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors text-center',
            currentPriority() === null
              ? 'border-charcoal bg-charcoal/5 text-charcoal'
              : 'border-cream-soft bg-offwhite text-charcoal hover:bg-cream',
          ]"
          @click="onSelect(null)"
        >
          <Flag :size="20" :stroke-width="2" aria-hidden="true" />
          <span>{{ t('item.priorityNone') }}</span>
        </button>
        <button
          type="button"
          role="radio"
          data-testid="priority-picker-urgent"
          :aria-checked="currentPriority() === 'urgent'"
          :class="[
            'flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors text-center text-orange-500',
            currentPriority() === 'urgent'
              ? 'border-orange-400 bg-orange-50'
              : 'border-cream-soft bg-offwhite hover:bg-orange-50/50',
          ]"
          @click="onSelect('urgent')"
        >
          <Flame :size="20" :stroke-width="2" aria-hidden="true" />
          <span>{{ t('item.priorityUrgent') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
