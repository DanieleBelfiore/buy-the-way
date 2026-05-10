<script setup lang="ts">
import { computed, type Component } from 'vue';
import type { Category } from '@/domain/types';
import IconApple from './icons/IconApple.vue';
import IconMilk from './icons/IconMilk.vue';
import IconBox from './icons/IconBox.vue';
import IconBread from './icons/IconBread.vue';
import IconBottle from './icons/IconBottle.vue';
import IconSnow from './icons/IconSnow.vue';
import IconSpray from './icons/IconSpray.vue';
import IconDrop from './icons/IconDrop.vue';
import IconTag from './icons/IconTag.vue';

interface Props {
  category: Category;
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
});

const ICON_MAP: Readonly<Record<Category, Component>> = {
  fruit_vegetables: IconApple,
  dairy: IconMilk,
  meat_fish: IconBox,
  bakery: IconBread,
  beverages: IconBottle,
  frozen: IconSnow,
  cleaning: IconSpray,
  hygiene: IconDrop,
  other: IconTag,
};

const COLOR_MAP: Readonly<Record<Category, string>> = {
  fruit_vegetables: 'var(--cat-fruit)',
  dairy: 'var(--cat-dairy)',
  meat_fish: 'var(--cat-meat)',
  bakery: 'var(--cat-bakery)',
  beverages: 'var(--cat-bev)',
  frozen: 'var(--cat-frozen)',
  cleaning: 'var(--cat-clean)',
  hygiene: 'var(--cat-hyg)',
  other: 'var(--cat-other)',
};

const iconComponent = computed((): Component => ICON_MAP[props.category]);
const tone = computed((): string => COLOR_MAP[props.category]);
</script>

<template>
  <span
    class="cat-icon"
    :style="{ color: tone }"
    :data-category="props.category"
    aria-hidden="true"
  >
    <component
      :is="iconComponent"
      :size="props.size"
    />
  </span>
</template>

<style scoped>
.cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
