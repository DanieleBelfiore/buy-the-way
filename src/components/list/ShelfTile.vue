<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Trash2 } from '@lucide/vue';
import InfoHint from '@/components/ui/InfoHint.vue';
import IconTooltip from '@/components/ui/IconTooltip.vue';
import { iconForItem } from '@/domain/public-catalog';
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

const itemIcon = computed(() =>
  iconForItem(props.entry.name, locale.value, props.entry.category),
);

const onAddClick = (): void => {
  emit('add', props.entry);
};

const onExcludeClick = (): void => {
  emit('exclude', props.entry);
};

const labelClasses = computed(() => [
  'min-w-0 truncate text-left text-sm',
  props.isTop ? 'font-semibold text-charcoal' : 'font-normal text-charcoal',
]);

const rowClasses = computed(() => [
  'flex items-center gap-1 w-full rounded-md border text-left transition-colors',
  props.inList
    ? 'border-primary/30 bg-primary/5'
    : 'border-cream-soft bg-offwhite',
]);
</script>

<template>
  <div :class="rowClasses" data-testid="shelf-tile">
    <button
      type="button"
      data-testid="shelf-tile-add"
      :aria-label="entry.name + (props.inList ? ` (${t('shelf.alreadyInList')})` : '')"
      class="flex flex-1 min-w-0 items-center gap-2 pl-3 py-2 rounded-l-md text-left select-none cursor-pointer hover:bg-cream active:bg-cream-soft"
      :class="props.inList ? 'hover:bg-primary/10 active:bg-primary/15' : ''"
      @click="onAddClick"
    >
      <span
        aria-hidden="true"
        data-testid="shelf-tile-icon"
        class="text-base leading-none shrink-0"
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
    </button>
    <IconTooltip :label="t('shelf.excludeTitle')">
      <button
        type="button"
        data-testid="shelf-tile-exclude"
        :aria-label="t('shelf.excludeTitle')"
        class="shrink-0 inline-flex items-center justify-center w-8 h-8 mr-1 rounded-full text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
        @click="onExcludeClick"
      >
        <Trash2 :size="14" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </IconTooltip>
  </div>
</template>
