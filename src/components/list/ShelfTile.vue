<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2 } from '@lucide/vue';
import { iconForName } from '@/domain/public-catalog';
import type { CatalogEntry } from '@/domain/types';

const props = defineProps<{
  entry: CatalogEntry;
  isTop: boolean;
}>();

const emit = defineEmits<{
  add: [CatalogEntry];
  /** Trash button — request to hide this entry from future suggestions. */
  exclude: [CatalogEntry];
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
  'flex-1 text-left text-sm truncate',
  props.isTop ? 'font-semibold text-charcoal' : 'font-normal text-charcoal',
]);

const buttonClasses =
  'group relative flex items-center gap-2 w-full pl-3 pr-8 py-2 rounded-md border border-cream-soft bg-offwhite text-left transition-colors select-none hover:bg-cream active:bg-cream-soft cursor-pointer';
</script>

<template>
  <button
    type="button"
    :aria-label="entry.name"
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
    <span :class="labelClasses">{{ entry.name }}</span>
    <span
      role="button"
      tabindex="0"
      data-testid="shelf-tile-exclude"
      :aria-label="t('shelf.excludeTitle')"
      :title="t('shelf.excludeTitle')"
      class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full text-red-600 hover:bg-red-100 active:bg-red-200 transition-colors cursor-pointer"
      @click="onRemoveClick"
      @pointerdown.stop
      @keydown.enter="onRemoveClick($event)"
      @keydown.space.prevent="onRemoveClick($event)"
    >
      <Trash2 :size="14" :stroke-width="2.25" aria-hidden="true" />
    </span>
  </button>
</template>
