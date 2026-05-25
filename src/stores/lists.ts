import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  createList as serviceCreateList,
  subscribeUserLists,
} from '@/services/lists.service';
import {
  getUserProfile,
  touchLastSeenList,
} from '@/services/users.service';
import { useAuthStore } from '@/stores/auth';
import type { List } from '@/domain/types';

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  /**
   * Legacy global "all lists seen at" timestamp from earlier versions. Kept as
   * a fallback for users whose profile still carries it; new writes go to
   * `lastSeenListMap` (per-list).
   */
  const lastSeenLists = ref<number>(0);
  const lastSeenListMap = ref<Record<string, number>>({});
  /**
   * True once the Firestore subscription has delivered at least one snapshot
   * (success OR failure) in this session. Lets stale-default-list cleanup
   * distinguish "no lists exist" (clear pref) from "we just haven't loaded
   * yet" (do nothing) — without this, an immediate-mode watch would
   * incorrectly clear the default on the first paint after a refresh.
   */
  const initialized = ref(false);

  // Ref-counted singleton subscription. Multiple views can call subscribe()
  // (ListsView, ListDetailView, ListSettingsView, StatsView) but only ONE
  // Firestore onSnapshot is opened — torn down when the last caller invokes
  // its returned unsub. Avoids 3–4x redundant snapshot listens on the same
  // query during normal navigation.
  let _refCount = 0;
  let _unsub: (() => void) | null = null;

  const subscribe = (): (() => void) => {
    const auth = useAuthStore();
    if (!auth.user) return () => {};

    _refCount += 1;

    // Only show the skeleton on the first-ever load. Re-subscribing on
    // re-mount (e.g. returning from /settings) must not flash the skeleton
    // when the Pinia store already holds fresh data.
    if (lists.value.length === 0) {
      loading.value = true;
    }

    if (!_unsub) {
      _unsub = subscribeUserLists(
        auth.user.uid,
        (incoming) => {
          lists.value = incoming;
          loading.value = false;
          initialized.value = true;
        },
        (err) => {
          error.value = err.message;
          loading.value = false;
          initialized.value = true;
        },
      );
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      _refCount = Math.max(0, _refCount - 1);
      if (_refCount === 0 && _unsub) {
        _unsub();
        _unsub = null;
      }
    };
  };

  const loadLastSeen = async (): Promise<void> => {
    const auth = useAuthStore();
    if (!auth.user) return;
    const profile = await getUserProfile(auth.user.uid);
    lastSeenLists.value = profile?.lastSeenLists ?? 0;
    lastSeenListMap.value = { ...(profile?.lastSeenListMap ?? {}) };
  };

  const markSeen = async (listId: string): Promise<void> => {
    const auth = useAuthStore();
    if (!auth.user) return;
    const now = Date.now();
    lastSeenListMap.value = { ...lastSeenListMap.value, [listId]: now };
    try {
      await touchLastSeenList(auth.user.uid, listId, now);
    } catch (err) {
      console.warn('[lists] touchLastSeenList failed:', err);
    }
  };

  const isNewForUser = (list: List, uid: string): boolean => {
    if (list.ownerUid === uid) return false;
    const perList = lastSeenListMap.value[list.id];
    const threshold = perList ?? lastSeenLists.value;
    return list.updatedAt > threshold;
  };

  const createList = async (name: string): Promise<string> => {
    const auth = useAuthStore();
    if (!auth.user) throw new Error('Not authenticated');
    const existing = lists.value.map((l) => l.name);
    return serviceCreateList(name, auth.user.uid, existing);
  };

  const clear = (): void => {
    lists.value = [];
    loading.value = false;
    error.value = null;
    initialized.value = false;
    lastSeenLists.value = 0;
    lastSeenListMap.value = {};
    // Force-release the underlying firestore subscription on identity change.
    // Holders still keep their refs (their onUnmounted will decrement to 0
    // again), but the snapshot listener for the OLD user is dead immediately
    // so we don't bleed a permission-denied error toward the new session.
    if (_unsub) {
      _unsub();
      _unsub = null;
    }
  };

  // Auto-clear cached lists whenever the signed-in identity changes. Done
  // here (not in the auth store) to avoid a static import cycle: the auth
  // store still needs to invalidate this cache on sign-out, and listening to
  // auth from inside lists keeps the dependency edge one-way (lists → auth).
  watch(
    () => useAuthStore().user?.uid ?? null,
    (newUid, oldUid) => {
      if (newUid !== oldUid) clear();
    },
  );

  return {
    lists,
    loading,
    error,
    lastSeenLists,
    lastSeenListMap,
    initialized,
    subscribe,
    loadLastSeen,
    markSeen,
    isNewForUser,
    createList,
    clear,
  };
});
