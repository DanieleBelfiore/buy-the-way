import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { subscribeItems } from '@/services/items.service';
import { CATEGORY_ORDER, migrateCategory } from '@/domain/categories';
import { sortItemsByPriorityThenName } from '@/domain/sort';
import type { Item, Category } from '@/domain/types';
import type { ULID } from '@/domain/id';

export const useItemsStore = defineStore('items', () => {
  const items = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentListId = ref<ULID | null>(null);

  let _unsubscribe: (() => void) | null = null;

  const itemsByCategory = computed((): Map<Category, Item[]> => {
    const map = new Map<Category, Item[]>();
    for (const cat of CATEGORY_ORDER) {
      const catItems = sortItemsByPriorityThenName(
        items.value.filter((i) => migrateCategory(i.category) === cat),
        'en',
      );
      if (catItems.length > 0) map.set(cat, catItems);
    }
    return map;
  });

  const setCurrentList = (listId: ULID | null): void => {
    _unsubscribe?.();
    _unsubscribe = null;
    items.value = [];
    error.value = null;
    currentListId.value = listId;

    if (!listId) return;

    loading.value = true;
    _unsubscribe = subscribeItems(
      listId,
      (incoming) => {
        items.value = incoming;
        loading.value = false;
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
  };

  return { items, loading, error, currentListId, itemsByCategory, setCurrentList };
});
