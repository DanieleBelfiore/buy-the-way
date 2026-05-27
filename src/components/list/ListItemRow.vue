<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, ArrowRightLeft, CircleDashed, Flag, Flame, Image, Settings, Star, Trash2, UserPlus } from '@lucide/vue';
import InfoHint from '@/components/ui/InfoHint.vue';
import { iconForItem, isCustomItemName } from '@/domain/public-catalog';
import { useFitText } from '@/composables/useFitText';
import type { Item, ItemPriority } from '@/domain/types';

const { t, locale } = useI18n();
const props = withDefaults(
  defineProps<{
    item: Item;
    canMoveCopy?: boolean;
    pinned?: boolean;
    /** S3.2: when true the row participates in bulk selection (tap = toggle). */
    selectionMode?: boolean;
    /** S3.2: whether this row is currently selected. */
    selected?: boolean;
    /** True when another list row is an exact duplicate of this item. */
    possibleDuplicate?: boolean;
  }>(),
  { canMoveCopy: true, pinned: false, selectionMode: false, selected: false, possibleDuplicate: false },
);
const icon = computed(() => iconForItem(props.item.name, locale.value, props.item.category));
const isCustom = computed(() => isCustomItemName(props.item.name, locale.value));

// Auto-fit the name + custom-badge + note onto one line. Re-measure when
// the item's name or note changes - `toRef` keeps the watch source live.
const nameContainerRef = ref<HTMLElement | null>(null);
const nameInnerRef = ref<HTMLElement | null>(null);
const nameSignature = computed(() => `${props.item.name}|${props.item.quantity}|${props.item.note}`);
useFitText(nameInnerRef, nameContainerRef, toRef(nameSignature));
const emit = defineEmits<{
  'toggle-checked': [boolean];
  remove: [];
  /** Open the item edit sheet - fired by the per-row Settings icon. */
  'open-edit': [Item];
  'request-priority': [Item];
  'move-copy': [Item];
  'toggle-pinned': [Item];
  /** S3.2: long-press → enter bulk-selection mode anchored on this row. */
  'select-enter': [Item];
  /** S3.2: tap while in selection mode → toggle this row's inclusion. */
  'select-toggle': [Item];
}>();

// S3.2: long-press detection. 500ms touch/mouse hold without movement opens
// bulk-selection mode. We track the initial pointer coordinates so a normal
// scroll doesn't trip the timer.
const LONG_PRESS_MS = 500;
let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressStartX = 0;
let pressStartY = 0;
const PRESS_CANCEL_PX = 8;

const clearPressTimer = (): void => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
};

const onPressStart = (e: PointerEvent): void => {
  if (props.selectionMode) return; // Already in mode, regular tap handles it.
  pressStartX = e.clientX;
  pressStartY = e.clientY;
  clearPressTimer();
  pressTimer = setTimeout(() => {
    pressTimer = null;
    emit('select-enter', props.item);
  }, LONG_PRESS_MS);
};

const onPressMove = (e: PointerEvent): void => {
  if (!pressTimer) return;
  const dx = Math.abs(e.clientX - pressStartX);
  const dy = Math.abs(e.clientY - pressStartY);
  if (dx > PRESS_CANCEL_PX || dy > PRESS_CANCEL_PX) clearPressTimer();
};

const onPressEnd = (): void => clearPressTimer();

const onClick = (): void => {
  if (props.selectionMode) {
    emit('select-toggle', props.item);
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
  emit('open-edit', props.item);
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
  if (props.item.priority === 'urgent') return Flame;
  if (props.item.priority === 'optional') return CircleDashed;
  return Flag;
});

const priorityAria = computed(() => {
  if (props.item.priority === 'urgent') return t('item.priorityUrgent');
  if (props.item.priority === 'optional') return t('item.priorityOptional');
  return t('item.priorityNone');
});

const priorityBtnClasses = computed(() => {
  if (props.item.priority === 'urgent') return 'text-orange-500';
  return 'text-charcoal';
});

const nameStateClasses = computed(() => {
  if (props.item.checked) return 'text-ink-40';
  if (props.item.priority === 'urgent') return 'text-orange-500 font-semibold';
  if (props.item.priority === 'optional') return 'text-muted-gray';
  return 'text-charcoal';
});
</script>

<template>
  <div
    :class="[
      'flex items-center min-h-[44px]',
      props.selectionMode && props.selected ? 'bg-primary/10' : '',
    ]"
  >
    <button
      data-testid="row-toggle"
      type="button"
      class="flex-1 flex items-center gap-3 pl-10 pr-0 min-h-[44px] text-left select-none"
      :aria-label="props.item.checked ? t('item.markAsToBuy') : t('item.markAsBought')"
      @click="onClick"
      @pointerdown="onPressStart"
      @pointermove="onPressMove"
      @pointerup="onPressEnd"
      @pointercancel="onPressEnd"
      @pointerleave="onPressEnd"
    >
      <span
        aria-hidden="true"
        data-testid="row-icon"
        class="text-base leading-none w-5 text-center"
      >
        {{ icon }}
      </span>
      <span
        ref="nameContainerRef"
        :class="['flex-1 min-w-0 text-sm', nameStateClasses]"
        data-testid="row-name-container"
        style="overflow: hidden;"
      >
        <span
          ref="nameInnerRef"
          data-testid="row-name-inner"
          class="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span :class="['font-medium', { 'line-through': props.item.checked }]">{{ props.item.name }}</span>
          <span
            v-if="props.item.quantity"
            data-testid="row-quantity"
            class="text-sm text-charcoal/70"
          >
            ({{ props.item.quantity }})
          </span>
          <InfoHint
            v-if="isCustom"
            :message="t('item.customBadgeHint')"
            test-id="row-custom-badge"
          >
            <UserPlus
              :size="13"
              :stroke-width="2"
              class="text-muted-gray"
              aria-hidden="true"
            />
          </InfoHint>
          <InfoHint
            v-if="props.possibleDuplicate"
            :message="t('item.possibleDuplicateHint')"
            test-id="row-duplicate-badge"
          >
            <AlertTriangle
              :size="13"
              :stroke-width="2"
              class="text-amber-500"
              aria-hidden="true"
            />
          </InfoHint>
          <InfoHint
            v-if="props.item.thumbURL"
            :message="t('item.photoHint')"
            test-id="row-photo-badge"
          >
            <Image
              :size="13"
              :stroke-width="2"
              class="text-muted-gray"
              aria-hidden="true"
            />
          </InfoHint>
          <span
            v-if="props.item.note"
            data-testid="row-note"
            class="text-xs text-muted-gray font-normal italic"
          >
            {{ props.item.note }}
          </span>
        </span>
      </span>
    </button>
    <div class="flex items-center shrink-0 -space-x-1 pr-0.5">
      <button
        data-testid="row-priority"
        type="button"
        :class="[
          'inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent transition-colors',
          priorityBtnClasses,
        ]"
        :aria-label="priorityAria"
        :data-priority="props.item.priority ?? 'none'"
        @click="onRequestPriority"
      >
        <component :is="priorityIcon" :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
      <button
        data-testid="row-pinned"
        type="button"
        class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent text-favorite-gold transition-colors"
        :aria-label="props.pinned ? t('item.unpinFavorite') : t('item.pinFavorite')"
        :aria-pressed="props.pinned"
        @click="onTogglePinned"
      >
        <Star
        :size="20"
        :stroke-width="props.pinned ? 2.25 : 2.5"
          :fill="props.pinned ? 'currentColor' : 'none'"
          aria-hidden="true"
        />
      </button>
      <button
        v-if="canMoveCopy"
        data-testid="row-move-copy"
        type="button"
        class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent text-charcoal transition-colors"
        :aria-label="t('item.moveOrCopy')"
        @click="onOpenMoveCopy"
      >
        <ArrowRightLeft :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
      <button
        data-testid="row-settings"
        type="button"
        class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent text-charcoal transition-colors"
        :aria-label="t('item.openSettings')"
        @click="onOpenSettings"
      >
        <Settings :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
      <button
        data-testid="row-remove"
        type="button"
        class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent text-red-600 transition-colors"
        :aria-label="t('item.remove')"
        @click="emit('remove')"
      >
        <Trash2 :size="20" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
