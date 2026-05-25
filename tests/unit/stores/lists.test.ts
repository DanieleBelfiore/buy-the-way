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
import { createList, subscribeUserLists } from '@/services/lists.service';
import { getUserProfile, touchLastSeenList } from '@/services/users.service';
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

  it('starts with empty lists, loading false, error null', () => {
    vi.mocked(subscribeUserLists).mockReturnValue(vi.fn());
    const store = useListsStore();
    expect(store.lists).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('subscribe calls subscribeUserLists with uid', () => {
    vi.mocked(subscribeUserLists).mockReturnValue(vi.fn());
    const store = useListsStore();
    store.subscribe();
    expect(subscribeUserLists).toHaveBeenCalledWith('uid-1', expect.any(Function), expect.any(Function));
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

  it('populates lists when onChange fires', () => {
    let capturedOnChange: ((lists: any[]) => void) | undefined;
    vi.mocked(subscribeUserLists).mockImplementation((_uid, onChange) => {
      capturedOnChange = onChange;
      return vi.fn();
    });

    const store = useListsStore();
    store.subscribe();

    const mockLists = [
      { id: '01ABC', name: 'Spesa', ownerUid: 'uid-1', collaboratorUids: ['uid-1'], createdAt: 100, updatedAt: 200 },
    ];
    capturedOnChange!(mockLists);

    expect(store.lists).toEqual(mockLists);
    expect(store.loading).toBe(false);
  });

  it('sets error when onError fires', () => {
    let capturedOnError: ((err: Error) => void) | undefined;
    vi.mocked(subscribeUserLists).mockImplementation((_uid, _onChange, onError) => {
      capturedOnError = onError;
      return vi.fn();
    });

    const store = useListsStore();
    store.subscribe();
    capturedOnError!(new Error('permission-denied'));

    expect(store.error).toBe('permission-denied');
  });

  it('createList calls service with name and current uid', async () => {
    vi.mocked(subscribeUserLists).mockReturnValue(vi.fn());
    vi.mocked(createList).mockResolvedValue('01ABC');

    const store = useListsStore();
    await store.createList('Spesa');

    expect(createList).toHaveBeenCalledWith('Spesa', 'uid-1', []);
  });

  it('createList throws when no user is signed in', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: null } as any);
    const store = useListsStore();
    await expect(store.createList('Spesa')).rejects.toThrow();
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

  describe('loadLastSeen', () => {
    it('reads profile.lastSeenLists (legacy fallback) into store', async () => {
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
        lastSeenLists: 12345,
      });
      const store = useListsStore();
      await store.loadLastSeen();
      expect(store.lastSeenLists).toBe(12345);
    });

    it('reads profile.lastSeenListMap into store', async () => {
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
        lastSeenListMap: { 'list-A': 100, 'list-B': 200 },
      });
      const store = useListsStore();
      await store.loadLastSeen();
      expect(store.lastSeenListMap).toEqual({ 'list-A': 100, 'list-B': 200 });
    });

    it('defaults missing maps to empty object and lastSeenLists to 0', async () => {
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
      });
      const store = useListsStore();
      await store.loadLastSeen();
      expect(store.lastSeenLists).toBe(0);
      expect(store.lastSeenListMap).toEqual({});
    });

    it('no-op when no user signed in', async () => {
      vi.mocked(useAuthStore).mockReturnValue({ user: null } as any);
      const store = useListsStore();
      await store.loadLastSeen();
      expect(getUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('markSeen', () => {
    it('calls touchLastSeenList with uid + listId + timestamp', async () => {
      vi.mocked(touchLastSeenList).mockResolvedValue(undefined);
      const store = useListsStore();
      await store.markSeen('list-A');
      expect(touchLastSeenList).toHaveBeenCalledWith('uid-1', 'list-A', expect.any(Number));
    });

    it('updates lastSeenListMap optimistically before the service resolves', async () => {
      let resolveSvc: () => void = () => {};
      vi.mocked(touchLastSeenList).mockImplementation(
        () => new Promise<void>((r) => { resolveSvc = r; }),
      );
      const store = useListsStore();
      const before = Date.now();
      const p = store.markSeen('list-A');
      const after = Date.now();
      expect(store.lastSeenListMap['list-A']).toBeGreaterThanOrEqual(before);
      expect(store.lastSeenListMap['list-A']).toBeLessThanOrEqual(after);
      resolveSvc();
      await p;
    });

    it('swallows errors with warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(touchLastSeenList).mockRejectedValue(new Error('offline'));
      const store = useListsStore();
      await expect(store.markSeen('list-A')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('isNewForUser', () => {
    it('returns false when uid is owner', () => {
      const store = useListsStore();
      const list = { id: '01A', name: 'X', ownerUid: 'uid-1', collaboratorUids: ['uid-1'], createdAt: 1, updatedAt: 999 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(false);
    });

    it('returns true when updatedAt > per-list seen entry', () => {
      const store = useListsStore();
      store.lastSeenListMap = { '01A': 100 };
      const list = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 200 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(true);
    });

    it('returns false when updatedAt <= per-list seen entry', () => {
      const store = useListsStore();
      store.lastSeenListMap = { '01A': 300 };
      const list = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 200 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(false);
    });

    it('falls back to legacy lastSeenLists when no per-list entry', () => {
      const store = useListsStore();
      store.lastSeenLists = 500;
      store.lastSeenListMap = {};
      const stale = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 400 } as any;
      const fresh = { id: '01B', name: 'Y', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 600 } as any;
      expect(store.isNewForUser(stale, 'uid-1')).toBe(false);
      expect(store.isNewForUser(fresh, 'uid-1')).toBe(true);
    });

    it('per-list entry overrides the legacy global timestamp', () => {
      const store = useListsStore();
      store.lastSeenLists = 1000;
      store.lastSeenListMap = { '01A': 100 };
      // updatedAt 500 < global 1000 but > per-list 100 → NEW because per-list wins
      const list = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 500 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(true);
    });

    it('per-list entry of 0 still overrides legacy global', () => {
      const store = useListsStore();
      store.lastSeenLists = 1000;
      store.lastSeenListMap = { '01A': 0 };
      const list = { id: '01A', name: 'X', ownerUid: 'someone', collaboratorUids: ['uid-1', 'someone'], createdAt: 1, updatedAt: 1 } as any;
      expect(store.isNewForUser(list, 'uid-1')).toBe(true);
    });
  });
});
