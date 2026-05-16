<script setup lang="ts">
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

const props = defineProps<{ category: Category }>();
</script>

<template>
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    xmlns="http://www.w3.org/2000/svg"
    :style="{ color: CATEGORIES[props.category].cssVar }"
    aria-hidden="true"
  >
    <circle cx="7" cy="7" r="7" fill="currentColor" />
  </svg>
</template>
