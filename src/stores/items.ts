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
  // S3.1: optimistic-delete buffer. Items whose IDs are in here have been
  // "deleted" from the user's perspective but the firestore call is still
  // pending in the undo window. They stay in `items` (firestore snapshot is
  // authoritative) but are filtered out of everything user-facing.
  const pendingDeleteIds = ref<Set<ULID>>(new Set());

  let _unsubscribe: (() => void) | null = null;

  const visibleItems = computed(() =>
    items.value.filter((i) => !pendingDeleteIds.value.has(i.id)),
  );

  const itemsByCategory = computed((): Map<Category, Item[]> => {
    const map = new Map<Category, Item[]>();
    for (const cat of CATEGORY_ORDER) {
      const catItems = sortItemsByPriorityThenName(
        visibleItems.value.filter((i) => migrateCategory(i.category) === cat),
        'en',
      );
      if (catItems.length > 0) map.set(cat, catItems);
    }
    return map;
  });

  const markPendingDelete = (id: ULID): void => {
    const next = new Set(pendingDeleteIds.value);
    next.add(id);
    pendingDeleteIds.value = next;
  };

  const unmarkPendingDelete = (id: ULID): void => {
    if (!pendingDeleteIds.value.has(id)) return;
    const next = new Set(pendingDeleteIds.value);
    next.delete(id);
    pendingDeleteIds.value = next;
  };

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

  return {
    items,
    visibleItems,
    loading,
    error,
    currentListId,
    itemsByCategory,
    pendingDeleteIds,
    markPendingDelete,
    unmarkPendingDelete,
    setCurrentList,
  };
});
