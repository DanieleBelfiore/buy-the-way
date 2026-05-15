import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/lists.service', () => ({
  createList: vi.fn(),
  subscribeUserLists: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useListsStore } from '@/stores/lists';
import { createList, subscribeUserLists } from '@/services/lists.service';
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

  it('subscribe returns the unsubscribe function', () => {
    const unsub = vi.fn();
    vi.mocked(subscribeUserLists).mockReturnValue(unsub);
    const store = useListsStore();
    const result = store.subscribe();
    expect(result).toBe(unsub);
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
      { id: '01ABC', name: 'Spesa', ownerUid: 'uid-1', collaboratorUids: ['uid-1'], deletedAt: null, createdAt: 100, updatedAt: 200 },
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

    expect(createList).toHaveBeenCalledWith('Spesa', 'uid-1');
  });

  it('createList throws when no user is signed in', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: null } as any);
    const store = useListsStore();
    await expect(store.createList('Spesa')).rejects.toThrow();
  });
});
