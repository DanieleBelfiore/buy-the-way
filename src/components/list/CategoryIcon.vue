<script setup lang="ts">
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

const props = defineProps<{ category: Category }>();
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-flex items-center justify-center text-base leading-none w-5"
    :style="{ color: CATEGORIES[props.category].cssVar }"
  >
    {{ CATEGORIES[props.category].icon }}
  </span>
</template>
