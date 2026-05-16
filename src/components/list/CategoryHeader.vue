<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CategoryIcon from './CategoryIcon.vue';
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

const { t } = useI18n();
const props = defineProps<{ category: Category }>();
</script>

<template>
  <div class="flex items-center gap-2 px-5 py-2">
    <CategoryIcon :category="props.category" />
    <span class="text-xs font-semibold text-muted-gray uppercase tracking-wider">
      {{ t(CATEGORIES[props.category].labelKey) }}
    </span>
  </div>
</template>
