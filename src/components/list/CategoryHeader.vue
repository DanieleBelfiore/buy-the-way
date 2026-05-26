<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CategoryIcon from './CategoryIcon.vue';
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

const { t } = useI18n();
const props = withDefaults(
  defineProps<{
    category: Category;
    bought?: number;
    total?: number;
    collapsed?: boolean;
    interactive?: boolean;
  }>(),
  {
    bought: 0,
    total: 0,
    collapsed: false,
    interactive: false,
  },
);

const emit = defineEmits<{ toggle: [] }>();
const onClick = (): void => {
  if (props.interactive) emit('toggle');
};
</script>

<template>
  <component
    :is="props.interactive ? 'button' : 'div'"
    :type="props.interactive ? 'button' : undefined"
    :aria-expanded="props.interactive ? !props.collapsed : undefined"
    :data-testid="props.interactive ? 'category-header' : undefined"
    class="cat-drag-handle w-full flex items-center gap-2 px-5 py-3 text-left"
    :class="props.interactive ? 'select-none cursor-pointer' : ''"
    @click="onClick"
  >
    <CategoryIcon :category="props.category" />
    <span class="text-base font-bold text-charcoal tracking-tight">
      {{ t(CATEGORIES[props.category].labelKey) }}
    </span>
    <span
      v-if="props.total > 0"
      data-testid="category-counter"
      class="text-sm text-muted-gray font-semibold tabular-nums"
    >
      {{ props.bought }}/{{ props.total }}
    </span>
    <span class="flex-1" aria-hidden="true" />
    <svg
      v-if="props.interactive"
      data-testid="category-chevron"
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-muted-gray transition-transform"
      :class="props.collapsed ? '-rotate-90' : 'rotate-0'"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </component>
</template>
