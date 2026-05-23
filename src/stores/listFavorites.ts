import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { subscribeListFavorites } from '@/services/listFavorites.service';
import { rankListFavorites } from '@/domain/ranking';
import type { ListFavoriteState } from '@/domain/types';
import type { ULID } from '@/domain/id';

/**
 * Per-list favorite shelf state. Subscribes to a single list at a time. Calling
 * `subscribe(listId)` while already subscribed swaps the subscription to the
 * new list and clears the previous list's entries from local state.
 */
export const useListFavoritesStore = defineStore('listFavorites', () => {
  const entries = ref<ListFavoriteState[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentListId = ref<ULID | null>(null);

  let _unsubscribe: (() => void) | null = null;

  const rankedEntries = computed(() => rankListFavorites(entries.value, Date.now()));

  /**
   * Set of item names that should appear in the favorites shelf for the
   * current list. Used by the row star to display fill state.
   */
  const pinnedNames = computed<Set<string>>(
    () => new Set(rankedEntries.value.map((e) => e.name)),
  );

  const subscribe = (listId: ULID): (() => void) => {
    _unsubscribe?.();
    currentListId.value = listId;
    entries.value = [];
    loading.value = true;
    _unsubscribe = subscribeListFavorites(
      listId,
      (incoming) => {
        entries.value = incoming;
        loading.value = false;
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
    return () => {
      _unsubscribe?.();
      _unsubscribe = null;
      currentListId.value = null;
    };
  };

  return {
    entries,
    loading,
    error,
    currentListId,
    rankedEntries,
    pinnedNames,
    subscribe,
  };
});
