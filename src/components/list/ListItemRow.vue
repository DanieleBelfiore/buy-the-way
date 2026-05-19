<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, ArrowRightLeft, CircleDashed, Flag, Settings, Star, Trash2, UserPlus } from '@lucide/vue';
import { iconForName, isCustomItemName } from '@/domain/public-catalog';
import type { Item, ItemPriority } from '@/domain/types';

const LONG_PRESS_MS = 500;

const { t, locale } = useI18n();
const props = withDefaults(
  defineProps<{
    item: Item;
    canMoveCopy?: boolean;
    pinned?: boolean;
  }>(),
  { canMoveCopy: true, pinned: false },
);
const icon = computed(() => iconForName(props.item.name, locale.value));
const isCustom = computed(() => isCustomItemName(props.item.name, locale.value));
const emit = defineEmits<{
  'toggle-checked': [boolean];
  remove: [];
  'long-press': [Item];
  'request-priority': [Item];
  'move-copy': [Item];
  'toggle-pinned': [Item];
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

const onRequestPriority = (e: MouseEvent): void => {
  e.stopPropagation();
  emit('request-priority', props.item);
};

const onOpenSettings = (e: MouseEvent): void => {
  e.stopPropagation();
  emit('long-press', props.item);
};

const onOpenMoveCopy = (e: MouseEvent): void => {
  e.stopPropagation();
  emit('move-copy', props.item);
};

const onTogglePinned = (e: MouseEvent): void => {
  e.stopPropagation();
  emit('toggle-pinned', props.item);
};

const priorityIcon = computed(() => {
  if (props.item.priority === 'urgent') return AlertTriangle;
  if (props.item.priority === 'optional') return CircleDashed;
  return Flag;
});

const priorityAria = computed(() => {
  if (props.item.priority === 'urgent') return t('item.priorityUrgent');
  if (props.item.priority === 'optional') return t('item.priorityOptional');
  return t('item.priorityNone');
});

const priorityBtnClasses = computed(() => {
  if (props.item.priority === 'urgent')
    return 'text-red-600 hover:bg-red-50 active:bg-red-100';
  return 'text-muted-gray hover:bg-black/5 active:bg-black/10';
});

const nameClasses = computed(() => {
  const base = 'flex-1 text-sm flex items-baseline gap-1.5 flex-wrap';
  if (props.item.checked) return `${base} line-through text-ink-40`;
  if (props.item.priority === 'urgent') return `${base} text-red-700 font-semibold`;
  if (props.item.priority === 'optional') return `${base} text-muted-gray`;
  return `${base} text-charcoal`;
});
</script>

<template>
  <div class="flex items-center min-h-[44px]">
    <button
      data-testid="row-toggle"
      type="button"
      class="flex-1 flex items-center gap-3 pl-10 pr-2 min-h-[44px] text-left select-none"
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
      <span :class="nameClasses">
        <span class="font-medium">{{ props.item.name }}</span>
        <UserPlus
          v-if="isCustom"
          data-testid="row-custom-badge"
          :size="13"
          :stroke-width="2"
          class="text-muted-gray shrink-0"
          :aria-label="t('item.customBadge')"
        />
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
      data-testid="row-priority"
      type="button"
      :class="[
        'inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent transition-colors',
        priorityBtnClasses,
      ]"
      :aria-label="priorityAria"
      :data-priority="props.item.priority ?? 'none'"
      @click="onRequestPriority"
    >
      <component :is="priorityIcon" :size="18" :stroke-width="2" aria-hidden="true" />
    </button>
    <button
      data-testid="row-pinned"
      type="button"
      :class="[
        'inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent transition-colors',
        props.pinned
          ? 'text-favorite-gold hover:bg-favorite-gold-soft active:bg-favorite-gold-soft'
          : 'text-muted-gray hover:bg-black/5 active:bg-black/10',
      ]"
      :aria-label="props.pinned ? t('item.unpinFavorite') : t('item.pinFavorite')"
      :aria-pressed="props.pinned"
      @click="onTogglePinned"
    >
      <Star :size="18" :stroke-width="2" :fill="props.pinned ? 'currentColor' : 'none'" aria-hidden="true" />
    </button>
    <button
      v-if="canMoveCopy"
      data-testid="row-move-copy"
      type="button"
      class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent text-muted-gray hover:bg-black/5 active:bg-black/10 transition-colors"
      :aria-label="t('item.moveOrCopy')"
      @click="onOpenMoveCopy"
    >
      <ArrowRightLeft :size="18" :stroke-width="2" aria-hidden="true" />
    </button>
    <button
      data-testid="row-settings"
      type="button"
      class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent text-muted-gray hover:bg-black/5 active:bg-black/10 transition-colors"
      :aria-label="t('item.openSettings')"
      @click="onOpenSettings"
    >
      <Settings :size="18" :stroke-width="2" aria-hidden="true" />
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
