import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { useAuthStore } from '@/stores/auth';
import {
  subscribeNotifications,
  deleteNotifications,
} from '@/services/notifications.service';
import type { NotificationDoc } from '@/domain/types';

/**
 * Realtime view of the signed-in user's notifications inbox.
 *
 * Subscribes on first call, switches subscription whenever the active uid
 * changes, and tears down on unmount. Exposes:
 *   - `items` (newest first)
 *   - `count` (computed length)
 *   - `consume()` -> snapshot the current ids, batch-delete them.
 *     Used by the popover open action to implement "view = clear".
 */
export interface UseNotifications {
  items: Ref<NotificationDoc[]>;
  count: ComputedRef<number>;
  consume: () => Promise<NotificationDoc[]>;
}

export const useNotifications = (): UseNotifications => {
  const authStore = useAuthStore();
  const items = ref<NotificationDoc[]>([]);
  let unsub: (() => void) | null = null;

  const stop = (): void => {
    if (unsub) {
      unsub();
      unsub = null;
    }
  };

  watch(
    () => authStore.user?.uid ?? null,
    (uid) => {
      stop();
      items.value = [];
      if (!uid) return;
      unsub = subscribeNotifications(uid, (next) => {
        items.value = next;
      });
    },
    { immediate: true },
  );

  onUnmounted(stop);

  const consume = async (): Promise<NotificationDoc[]> => {
    const uid = authStore.user?.uid;
    if (!uid) return [];
    const snapshot = items.value.slice();
    if (snapshot.length === 0) return [];
    const consumedIds = new Set(snapshot.map((n) => n.id));
    // Drop the consumed rows locally immediately so the badge clears without
    // waiting for the Firestore snapshot round-trip. The listener will
    // reconcile once the batch delete propagates.
    items.value = items.value.filter((n) => !consumedIds.has(n.id));
    await deleteNotifications(uid, snapshot.map((n) => n.id));
    return snapshot;
  };

  return {
    items,
    count: computed(() => items.value.length),
    consume,
  };
};
