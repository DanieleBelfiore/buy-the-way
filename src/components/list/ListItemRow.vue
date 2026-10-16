<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, Check, CircleDashed, Flag, Flame, Image, Settings, Trash2, UserPlus } from '@lucide/vue';
import InfoHint from '@/components/ui/InfoHint.vue';
import { iconForItem, isCustomItemName } from '@/domain/public-catalog';
import type { Item } from '@/domain/types';

const { t, locale } = useI18n();
const props = withDefaults(
  defineProps<{
    item: Item;
    /** S3.2: when true the row participates in bulk selection (tap = toggle). */
    selectionMode?: boolean;
    /** S3.2: whether this row is currently selected. */
    selected?: boolean;
    /** True when another list row is an exact duplicate of this item. */
    possibleDuplicate?: boolean;
  }>(),
  { selectionMode: false, selected: false, possibleDuplicate: false },
);
const icon = computed(() => iconForItem(props.item.name, locale.value, props.item.category));
const isCustom = computed(() => isCustomItemName(props.item.name, locale.value));

const emit = defineEmits<{
  'toggle-checked': [boolean];
  remove: [];
  /** Open the item edit sheet - fired by the per-row Settings icon. */
  'open-edit': [Item];
  'request-priority': [Item];
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

// Row actions stay quiet so the names lead: a thinner stroke and a softer
// grey at rest, softer still on bought rows. Both greys keep 3:1 against the
// background (WCAG 1.4.11) in both themes. A set priority is information, so
// its icon keeps full colour and weight.
const hasPriority = computed(() => props.item.priority === 'urgent' || props.item.priority === 'optional');
const actionToneClass = computed(() => (props.item.checked ? 'text-muted-gray/75' : 'text-muted-gray/90'));
const ACTION_STROKE = 1.75;

const priorityBtnClasses = computed(() => {
  if (props.item.priority === 'urgent') return 'text-urgent';
  if (props.item.priority === 'optional') return 'text-muted-gray';
  return actionToneClass.value;
});
const priorityStroke = computed(() => (hasPriority.value ? 2 : ACTION_STROKE));

const nameStateClasses = computed(() => {
  if (props.item.checked) return 'text-muted-gray/70';
  if (props.item.priority === 'urgent') return 'text-urgent font-semibold';
  if (props.item.priority === 'optional') return 'text-muted-gray';
  return 'text-charcoal';
});
</script>

<template>
  <div
    data-testid="list-item-row"
    :class="[
      'flex items-center min-h-[44px] transition-colors active:bg-charcoal/5',
      props.selectionMode && props.selected ? 'bg-primary/10' : '',
    ]"
  >
    <!-- The toggle is a transparent button stretched over this area rather
         than a wrapper around it: the InfoHint badges are buttons too, and a
         button inside a button is invalid HTML. The visible content sits
         under the toggle (unpositioned, so taps land on the toggle); the
         badges are positioned and come later, so they stay on top. -->
    <div class="relative flex-1 min-w-0 flex items-center gap-3 pl-5 pr-0 min-h-[44px] text-left select-none">
      <button
        data-testid="row-toggle"
        type="button"
        class="absolute inset-0 w-full"
        :aria-label="t(props.item.checked ? 'item.markAsToBuy' : 'item.markAsBought', { name: props.item.name })"
        @click="onClick"
        @pointerdown="onPressStart"
        @pointermove="onPressMove"
        @pointerup="onPressEnd"
        @pointercancel="onPressEnd"
        @pointerleave="onPressEnd"
      />
      <span
        aria-hidden="true"
        data-testid="row-check"
        :data-checked="props.item.checked"
        :class="[
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
          props.item.checked
            ? 'border-primary bg-primary text-white'
            : 'border-muted-gray/50 bg-transparent',
        ]"
      >
        <Check v-if="props.item.checked" :size="12" :stroke-width="3" />
      </span>
      <span
        aria-hidden="true"
        data-testid="row-icon"
        class="text-base leading-none w-5 text-center"
      >
        {{ icon }}
      </span>
      <!-- Long names wrap to a second line at full size instead of shrinking:
           the list is read at arm's length in a shop. -->
      <span
        :class="['flex-1 min-w-0 py-2 text-sm leading-snug transition-colors duration-200', nameStateClasses]"
        data-testid="row-name-container"
      >
        <span data-testid="row-name-inner" class="line-clamp-2 [overflow-wrap:anywhere]">
          <span :class="['font-medium', { 'line-through': props.item.checked }]">{{ props.item.name }}</span>
          <span
            v-if="props.item.quantity"
            data-testid="row-quantity"
            class="ml-1 text-sm text-charcoal/70"
          >
            ({{ props.item.quantity }})
          </span>
          <InfoHint
            v-if="isCustom"
            class="ml-1 align-middle"
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
            class="ml-1 align-middle"
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
            class="ml-1 align-middle"
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
            class="ml-1.5 text-xs text-muted-gray font-normal italic"
          >
            {{ props.item.note }}
          </span>
        </span>
      </span>
    </div>
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
        <component :is="priorityIcon" :size="20" :stroke-width="priorityStroke" aria-hidden="true" />
      </button>
      <button
        data-testid="row-settings"
        type="button"
        :class="['inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent transition-colors', actionToneClass]"
        :aria-label="t('item.openSettings')"
        @click="onOpenSettings"
      >
        <Settings :size="20" :stroke-width="ACTION_STROKE" aria-hidden="true" />
      </button>
      <button
        data-testid="row-remove"
        type="button"
        :class="['inline-flex items-center justify-center w-11 h-11 rounded-full bg-transparent transition-colors', actionToneClass]"
        :aria-label="t('item.remove')"
        @click="emit('remove')"
      >
        <Trash2 :size="20" :stroke-width="ACTION_STROKE" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
