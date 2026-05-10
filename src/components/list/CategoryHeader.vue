<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Category } from '@/domain/types';
import CategoryIcon from '@/components/ui/CategoryIcon.vue';

interface Props {
  category: Category;
  checked: number;
  total: number;
}

const props = defineProps<Props>();
const { t } = useI18n();

const label = computed((): string => t(`category.${props.category}`));
</script>

<template>
  <div
    class="sec-h"
    :data-category="props.category"
  >
    <span class="sec-h__lead">
      <CategoryIcon
        :category="props.category"
        :size="18"
      />
      <span class="sec-h__label">{{ label }}</span>
    </span>
    <span
      class="sec-h__count"
      aria-hidden="true"
    >
      {{ props.checked }}/{{ props.total }}
    </span>
  </div>
</template>

<style scoped>
.sec-h__lead {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.sec-h__label {
  font-weight: 600;
}

.sec-h__count {
  font-variant-numeric: tabular-nums;
  color: var(--ink-40);
  font-weight: 500;
  letter-spacing: 0;
}
</style>
