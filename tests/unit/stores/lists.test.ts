import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/lists.service', () => ({
  createList: vi.fn(),
  subscribeUserLists: vi.fn(),
}));

vi.mock('@/services/users.service', () => ({
  getUserProfile: vi.fn(),
  touchLastSeenList: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useListsStore } from '@/stores/lists';
import { subscribeUserLists } from '@/services/lists.service';
import { useAuthStore } from '@/stores/auth';

const mockUser = { uid: 'uid-1', email: 'a@b.com', displayName: 'A' };

describe('useListsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      ready: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
      init: vi.fn(),
    } as any);
  });

  it('subscribe returns an unsubscribe that releases the underlying firestore listener when refcount reaches 0', () => {
    const unsub = vi.fn();
    vi.mocked(subscribeUserLists).mockReturnValue(unsub);
    const store = useListsStore();
    const release1 = store.subscribe();
    const release2 = store.subscribe();
    // Single underlying snapshot regardless of how many callers subscribe.
    expect(subscribeUserLists).toHaveBeenCalledOnce();
    release1();
    expect(unsub).not.toHaveBeenCalled(); // ref still held by release2
    release2();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('clears cached state when the signed-in user uid changes', async () => {
    const { reactive, nextTick } = await import('vue');
    const authState = reactive<{ user: { uid: string; email: string; displayName: string } | null }>({
      user: { uid: 'uid-1', email: 'a@b.com', displayName: 'A' },
    });
    vi.mocked(useAuthStore).mockReturnValue(authState as any);
    vi.mocked(subscribeUserLists).mockReturnValue(vi.fn());

    const store = useListsStore();
    store.lists = [{ id: 'L1' } as any];
    store.lastSeenLists = 999;
    store.initialized = true;

    authState.user = { uid: 'uid-2', email: 'c@d.com', displayName: 'C' };
    await nextTick();

    expect(store.lists).toEqual([]);
    expect(store.lastSeenLists).toBe(0);
    expect(store.initialized).toBe(false);
  });

  describe('isNewForUser', () => {
    it('returns true when updatedAt > per-list seen entry', () => {
      const store = useListsStore();
      store.lastSeenLoaded = true;
      store.lastSeenListMap = { '01A': 100 };
      const list = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 200 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(true);
    });
  });

  describe('lastSeenLoaded', () => {
    const shared = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 200 } as any;

    it('reports nothing as NEW until the seen map has loaded', () => {
      const store = useListsStore();
      expect(store.isNewForUser(shared, 'uid-1')).toBe(false);
    });
  });

  describe('pending-delete buffer (S3.1)', () => {
    it('marked id disappears from visibleLists while remaining in lists', () => {
      const store = useListsStore();
      store.lists = [
        { id: 'L1', name: 'A', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 1 } as any,
        { id: 'L2', name: 'B', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 1 } as any,
      ];
      expect(store.visibleLists).toHaveLength(2);
      store.markPendingDelete('L1');
      expect(store.visibleLists.map((l) => l.id)).toEqual(['L2']);
      expect(store.lists).toHaveLength(2);
    });

    it('unmarkPendingDelete restores the row', () => {
      const store = useListsStore();
      store.lists = [{ id: 'L1', name: 'A', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 1 } as any];
      store.markPendingDelete('L1');
      expect(store.visibleLists).toHaveLength(0);
      store.unmarkPendingDelete('L1');
      expect(store.visibleLists).toHaveLength(1);
    });
  });
});
