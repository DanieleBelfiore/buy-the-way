import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  createList as serviceCreateList,
  subscribeUserLists,
} from '@/services/lists.service';
import { getUserProfile, touchLastSeenLists } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth';
import type { List } from '@/domain/types';

export const useListsStore = defineStore('lists', () => {
  const lists = ref<List[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastSeenLists = ref<number>(0);

  const subscribe = (): (() => void) => {
    const auth = useAuthStore();
    // Only show the skeleton on the first-ever load. Re-subscribing on
    // re-mount (e.g. returning from /settings) must not flash the skeleton
    // when the Pinia store already holds fresh data.
    if (lists.value.length === 0) {
      loading.value = true;
    }
    return subscribeUserLists(
      auth.user!.uid,
      (incoming) => {
        lists.value = incoming;
        loading.value = false;
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
  };

  const loadLastSeen = async (): Promise<void> => {
    const auth = useAuthStore();
    if (!auth.user) return;
    const profile = await getUserProfile(auth.user.uid);
    lastSeenLists.value = profile?.lastSeenLists ?? 0;
  };

  const markSeen = async (): Promise<void> => {
    const auth = useAuthStore();
    if (!auth.user) return;
    const now = Date.now();
    try {
      await touchLastSeenLists(auth.user.uid, now);
    } catch (err) {
      console.warn('[lists] touchLastSeenLists failed:', err);
    }
  };

  const isNewForUser = (list: List, uid: string): boolean => {
    if (list.ownerUid === uid) return false;
    return list.updatedAt > lastSeenLists.value;
  };

  const createList = async (name: string): Promise<string> => {
    const auth = useAuthStore();
    if (!auth.user) throw new Error('Not authenticated');
    const existing = lists.value.map((l) => l.name);
    return serviceCreateList(name, auth.user.uid, existing);
  };

  return {
    lists,
    loading,
    error,
    lastSeenLists,
    subscribe,
    loadLastSeen,
    markSeen,
    isNewForUser,
    createList,
  };
});
