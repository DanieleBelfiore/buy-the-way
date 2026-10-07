import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { subscribeItems } from '@/services/items.service';
import { countUrgentItems } from '@/domain/priority';
import { useAuthStore } from '@/stores/auth';

export interface ListLiveCounts {
  itemCount: number;
  urgentCount: number;
}

/**
 * Item counts for the lists overview, derived from the real item docs of
 * each list - the same source the detail view counts from, so the two can
 * never disagree. The denormalized `itemCount` / `urgentCount` on the list
 * doc drift (blind decrements, non-atomic writes) and are only a fallback
 * for the instant before a list's first items snapshot arrives.
 */
export const useListItemCountsStore = defineStore('listItemCounts', () => {
  const counts = ref<Record<string, ListLiveCounts>>({});
  const _unsubs = new Map<string, () => void>();

  const dropCount = (listId: string): void => {
    if (!(listId in counts.value)) return;
    const next = { ...counts.value };
    delete next[listId];
    counts.value = next;
  };

  /** Open a listener for every id not tracked yet, close the ones gone. */
  const sync = (listIds: readonly string[]): void => {
    const wanted = new Set(listIds);
    for (const [id, unsub] of _unsubs) {
      if (wanted.has(id)) continue;
      unsub();
      _unsubs.delete(id);
      dropCount(id);
    }
    for (const id of wanted) {
      if (_unsubs.has(id)) continue;
      _unsubs.set(
        id,
        subscribeItems(
          id,
          (items) => {
            counts.value = {
              ...counts.value,
              [id]: { itemCount: items.length, urgentCount: countUrgentItems(items) },
            };
          },
          (err) => {
            console.warn('[listItemCounts] items listener failed:', err);
            dropCount(id);
          },
        ),
      );
    }
  };

  /**
   * Close every listener. Counts are kept so the overview paints the last
   * known numbers on the next visit instead of flashing the stored ones.
   */
  const stop = (): void => {
    for (const unsub of _unsubs.values()) unsub();
    _unsubs.clear();
  };

  // Same one-way edge as the lists store: never show the previous user's
  // numbers, and never leave their listeners to fail with permission-denied.
  watch(
    () => useAuthStore().user?.uid ?? null,
    (newUid, oldUid) => {
      if (newUid === oldUid) return;
      stop();
      counts.value = {};
    },
  );

  return { counts, sync, stop };
});
