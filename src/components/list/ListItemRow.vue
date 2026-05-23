<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, ArrowRightLeft, CircleDashed, Flag, Settings, Star, Trash2, UserPlus } from '@lucide/vue';
import { iconForName, isCustomItemName } from '@/domain/public-catalog';
import { useFitText } from '@/composables/useFitText';
import type { Item, ItemPriority } from '@/domain/types';

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

// Auto-fit the name + custom-badge + note onto one line. Re-measure when
// the item's name or note changes — `toRef` keeps the watch source live.
const nameContainerRef = ref<HTMLElement | null>(null);
const nameInnerRef = ref<HTMLElement | null>(null);
const nameSignature = computed(() => `${props.item.name}|${props.item.quantity}|${props.item.note}`);
useFitText(nameInnerRef, nameContainerRef, toRef(nameSignature));
const emit = defineEmits<{
  'toggle-checked': [boolean];
  remove: [];
  /** Open the item edit sheet — fired by the per-row Settings icon. */
  'open-edit': [Item];
  'request-priority': [Item];
  'move-copy': [Item];
  'toggle-pinned': [Item];
}>();

const onClick = (): void => {
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

const nameStateClasses = computed(() => {
  if (props.item.checked) return 'text-ink-40';
  if (props.item.priority === 'urgent') return 'text-red-700 font-semibold';
  if (props.item.priority === 'optional') return 'text-muted-gray';
  return 'text-charcoal';
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
          <UserPlus
            v-if="isCustom"
            data-testid="row-custom-badge"
            :size="13"
            :stroke-width="2"
            class="text-muted-gray shrink-0"
            :aria-label="t('item.customBadge')"
          />
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
