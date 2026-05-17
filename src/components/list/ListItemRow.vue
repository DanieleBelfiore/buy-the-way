<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2 } from '@lucide/vue';
import { iconForName } from '@/domain/public-catalog';
import type { Item } from '@/domain/types';

const LONG_PRESS_MS = 500;

const { t, locale } = useI18n();
const props = defineProps<{ item: Item }>();
const icon = computed(() => iconForName(props.item.name, locale.value));
const emit = defineEmits<{
  'toggle-checked': [boolean];
  remove: [];
  'long-press': [Item];
}>();

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressed = false;

const clearTimer = (): void => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
};

const onPointerDown = (e: PointerEvent): void => {
  if (e.pointerType !== 'mouse' && e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  if ((e as PointerEvent).button && (e as PointerEvent).button !== 0) return;
  longPressed = false;
  clearTimer();
  pressTimer = setTimeout(() => {
    longPressed = true;
    emit('long-press', props.item);
  }, LONG_PRESS_MS);
};

const onPointerUp = (): void => {
  clearTimer();
};

const onPointerCancel = (): void => {
  clearTimer();
  longPressed = false;
};

const onClick = (): void => {
  if (longPressed) {
    longPressed = false;
    return;
  }
  emit('toggle-checked', !props.item.checked);
};
</script>

<template>
  <div class="flex items-center min-h-[44px]">
    <button
      data-testid="row-toggle"
      type="button"
      class="flex-1 flex items-center gap-3 pl-10 pr-5 min-h-[44px] text-left select-none"
      :aria-label="props.item.checked ? t('item.markAsToBuy') : t('item.markAsBought')"
      @click="onClick"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerCancel"
    >
      <span
        aria-hidden="true"
        data-testid="row-icon"
        class="text-base leading-none w-5 text-center"
      >
        {{ icon }}
      </span>
      <span
        :class="[
          'flex-1 text-sm flex items-baseline gap-1.5 flex-wrap',
          props.item.checked ? 'line-through text-ink-40' : 'text-charcoal',
        ]"
      >
        <span class="font-medium">{{ props.item.name }}</span>
        <span
          v-if="props.item.quantity"
          data-testid="row-quantity"
          class="text-xs text-muted-gray font-normal"
        >
          {{ props.item.quantity }}
        </span>
        <span
          v-if="props.item.quantity && props.item.note"
          aria-hidden="true"
          class="text-xs text-muted-gray font-normal"
        >
          ·
        </span>
        <span
          v-if="props.item.note"
          data-testid="row-note"
          class="text-xs text-muted-gray font-normal italic"
        >
          {{ props.item.note }}
        </span>
      </span>
    </button>
    <button
      data-testid="row-remove"
      type="button"
      class="inline-flex items-center justify-center w-10 h-10 mr-2 rounded-full bg-transparent text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
      :aria-label="t('item.remove')"
      @click="emit('remove')"
    >
      <Trash2 :size="18" :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
</template>
