<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Trash2 } from '@lucide/vue';
import InfoHint from '@/components/ui/InfoHint.vue';
import IconTooltip from '@/components/ui/IconTooltip.vue';
import { iconForName } from '@/domain/public-catalog';
import type { ListFavoriteState } from '@/domain/types';

const props = defineProps<{
  entry: ListFavoriteState;
  isTop: boolean;
  inList?: boolean;
}>();

const emit = defineEmits<{
  add: [ListFavoriteState];
  /** Trash button - request to hide this entry from this list's favorites shelf. */
  exclude: [ListFavoriteState];
}>();

const { t, locale } = useI18n();

const itemIcon = computed(() => iconForName(props.entry.name, locale.value));

const onClick = (): void => {
  emit('add', props.entry);
};

const onRemoveClick = (e: MouseEvent | KeyboardEvent): void => {
  e.stopPropagation();
  emit('exclude', props.entry);
};

const labelClasses = computed(() => [
  'min-w-0 truncate text-left text-sm',
  props.isTop ? 'font-semibold text-charcoal' : 'font-normal text-charcoal',
]);

const buttonClasses = computed(() => [
  'group relative flex items-center gap-2 w-full pl-3 pr-8 py-2 rounded-md border text-left transition-colors select-none cursor-pointer',
  props.inList
    ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 active:bg-primary/15'
    : 'border-cream-soft bg-offwhite hover:bg-cream active:bg-cream-soft',
]);
</script>

<template>
  <button
    type="button"
    :aria-label="entry.name + (props.inList ? ` (${t('shelf.alreadyInList')})` : '')"
    :class="buttonClasses"
    @click="onClick"
  >
    <span
      aria-hidden="true"
      data-testid="shelf-tile-icon"
      class="text-base leading-none"
    >
      {{ itemIcon }}
    </span>
    <span class="flex-1 min-w-0 flex items-center gap-1">
      <span :class="labelClasses">{{ entry.name }}</span>
      <InfoHint
        v-if="props.inList"
        :message="t('shelf.alreadyInListHint')"
        test-id="shelf-tile-in-list"
        class="shrink-0"
      >
        <Check :size="14" :stroke-width="2.5" class="text-primary" aria-hidden="true" />
      </InfoHint>
    </span>
    <IconTooltip :label="t('shelf.excludeTitle')">
      <span
        role="button"
        tabindex="0"
        data-testid="shelf-tile-exclude"
        :aria-label="t('shelf.excludeTitle')"
        class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full text-red-600 transition-colors cursor-pointer"
        @click="onRemoveClick"
        @pointerdown.stop
        @keydown.enter="onRemoveClick($event)"
        @keydown.space.prevent="onRemoveClick($event)"
      >
        <Trash2 :size="14" :stroke-width="2.25" aria-hidden="true" />
      </span>
    </IconTooltip>
  </button>
</template>
