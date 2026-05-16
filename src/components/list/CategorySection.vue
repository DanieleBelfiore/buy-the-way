<script setup lang="ts">
import CategoryHeader from './CategoryHeader.vue';
import ListItemRow from './ListItemRow.vue';
import type { Category, Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const props = defineProps<{ category: Category; items: Item[] }>();
const emit = defineEmits<{ 'toggle-checked': [id: ULID, checked: boolean] }>();
</script>

<template>
  <section>
    <CategoryHeader :category="props.category" />
    <ListItemRow
      v-for="item in props.items"
      :key="item.id"
      :item="item"
      @toggle-checked="(val) => emit('toggle-checked', item.id, val)"
    />
  </section>
</template>
