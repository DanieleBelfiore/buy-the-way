<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CategoryIcon from '@/components/list/CategoryIcon.vue';
import type { CatalogEntry } from '@/domain/types';

const props = defineProps<{
  entry: CatalogEntry;
  isTop: boolean;
  isInList: boolean;
}>();

const emit = defineEmits<{ add: [CatalogEntry] }>();

const { t } = useI18n();

const onClick = () => {
  if (props.isInList) return;
  emit('add', props.entry);
};

const labelClasses = computed(() => [
  'flex-1 text-left text-sm truncate',
  props.isTop ? 'font-semibold text-charcoal' : 'font-normal text-charcoal',
]);

const buttonClasses = computed(() => [
  'relative flex items-center gap-2 w-full px-3 py-2 rounded-md border border-cream-soft bg-white text-left transition-colors',
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
  >
    <span
      v-if="isTop"
      data-testid="shelf-tile-top"
      class="absolute left-0 top-1 bottom-1 w-1 rounded-r-sm bg-charcoal"
      aria-hidden="true"
    />
    <CategoryIcon :category="entry.category" />
    <span :class="labelClasses">{{ entry.name }}</span>
    <span
      v-if="isInList"
      data-testid="shelf-tile-check"
      aria-hidden="true"
      class="text-xs text-muted-gray"
      >✓</span
    >
  </button>
</template>
