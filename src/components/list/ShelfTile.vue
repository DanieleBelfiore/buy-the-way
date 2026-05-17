<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { X } from '@lucide/vue';
import { iconForName } from '@/domain/public-catalog';
import type { CatalogEntry } from '@/domain/types';

const LONG_PRESS_MS = 500;

const props = defineProps<{
  entry: CatalogEntry;
  isTop: boolean;
  isInList: boolean;
}>();

const emit = defineEmits<{
  add: [CatalogEntry];
  'long-press': [CatalogEntry];
}>();

const { t, locale } = useI18n();

const itemIcon = computed(() => iconForName(props.entry.name, locale.value));

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressed = false;

const clearTimer = (): void => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
};

const onPointerDown = (e: PointerEvent): void => {
  if (e.button && e.button !== 0) return;
  longPressed = false;
  clearTimer();
  pressTimer = setTimeout(() => {
    longPressed = true;
    emit('long-press', props.entry);
  }, LONG_PRESS_MS);
};

const onPointerUp = (): void => clearTimer();
const onPointerCancel = (): void => {
  clearTimer();
  longPressed = false;
};

const onClick = () => {
  if (longPressed) {
    longPressed = false;
    return;
  }
  if (props.isInList) return;
  emit('add', props.entry);
};

const onRemoveClick = (e: MouseEvent) => {
  e.stopPropagation();
  clearTimer();
  longPressed = true;
  emit('long-press', props.entry);
};

const labelClasses = computed(() => [
  'flex-1 text-left text-sm truncate',
  props.isTop ? 'font-semibold text-charcoal' : 'font-normal text-charcoal',
]);

const buttonClasses = computed(() => [
  'group relative flex items-center gap-2 w-full pl-3 pr-8 py-2 rounded-md border border-cream-soft bg-white text-left transition-colors select-none',
  props.isInList
    ? 'line-through opacity-50 cursor-not-allowed'
    : 'hover:bg-cream active:bg-cream-soft cursor-pointer',
]);

const ariaLabel = computed(() =>
  props.isInList ? `${props.entry.name} — ${t('shelf.alreadyInList')}` : props.entry.name,
);

const titleAttr = computed(() => (props.isInList ? t('shelf.alreadyInList') : undefined));
</script>

<template>
  <button
    type="button"
    :aria-disabled="isInList ? 'true' : undefined"
    :aria-label="ariaLabel"
    :title="titleAttr"
    :class="buttonClasses"
    @click="onClick"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <span
      aria-hidden="true"
      data-testid="shelf-tile-icon"
      class="text-base leading-none"
    >
      {{ itemIcon }}
    </span>
    <span :class="labelClasses">{{ entry.name }}</span>
    <span
      role="button"
      tabindex="0"
      data-testid="shelf-tile-exclude"
      :aria-label="t('shelf.excludeTitle')"
      :title="t('shelf.excludeTitle')"
      class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-gray hover:bg-red-100 hover:text-red-600 active:bg-red-200 transition-colors cursor-pointer"
      @click="onRemoveClick"
      @pointerdown.stop
      @keydown.enter="onRemoveClick($event as unknown as MouseEvent)"
      @keydown.space.prevent="onRemoveClick($event as unknown as MouseEvent)"
    >
      <X :size="14" :stroke-width="2.25" aria-hidden="true" />
    </span>
  </button>
</template>
