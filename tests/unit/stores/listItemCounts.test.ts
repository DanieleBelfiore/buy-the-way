import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick, reactive } from 'vue';

vi.mock('@/services/items.service', () => ({
  subscribeItems: vi.fn(),
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

import { useListItemCountsStore } from '@/stores/listItemCounts';
import { subscribeItems } from '@/services/items.service';
import { useAuthStore } from '@/stores/auth';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
  id: id as ULID,
  listId: 'L1' as ULID,
  name: 'Latte',
  quantity: '1',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-1',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('useListItemCountsStore', () => {
  const listeners = new Map<
    string,
    { onChange: (items: Item[]) => void; onError: (err: Error) => void; unsub: ReturnType<typeof vi.fn> }
  >();
  const auth = reactive<{ user: { uid: string } | null }>({ user: { uid: 'uid-1' } });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listeners.clear();
    auth.user = { uid: 'uid-1' };
    vi.mocked(useAuthStore).mockReturnValue(auth as any);
    vi.mocked(subscribeItems).mockImplementation((id, onChange, onError) => {
      const unsub = vi.fn();
      listeners.set(id, { onChange, onError, unsub });
      return unsub;
    });
  });

  it('opens one items listener per list', () => {
    const store = useListItemCountsStore();
    store.sync(['L1', 'L2']);
    expect(subscribeItems).toHaveBeenCalledTimes(2);
    expect(listeners.has('L1')).toBe(true);
    expect(listeners.has('L2')).toBe(true);
  });

  it('has no count for a list until its first snapshot arrives', () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    expect(store.counts.L1).toBeUndefined();
  });

  it('counts the real item docs, urgent ones included', () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    listeners.get('L1')!.onChange([
      makeItem('I1'),
      makeItem('I2', { priority: 'urgent' }),
      makeItem('I3', { checked: true }),
    ]);
    expect(store.counts.L1).toEqual({ itemCount: 3, urgentCount: 1 });
  });

  it('reports zero for a list emptied while the menu is open', () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    listeners.get('L1')!.onChange([makeItem('I1')]);
    listeners.get('L1')!.onChange([]);
    expect(store.counts.L1).toEqual({ itemCount: 0, urgentCount: 0 });
  });

  it('does not reopen a listener for a list already tracked', () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    store.sync(['L1', 'L2']);
    expect(subscribeItems).toHaveBeenCalledTimes(2);
  });

  it('closes the listener and drops the count of a list that disappeared', () => {
    const store = useListItemCountsStore();
    store.sync(['L1', 'L2']);
    listeners.get('L1')!.onChange([makeItem('I1')]);
    const { unsub } = listeners.get('L1')!;
    store.sync(['L2']);
    expect(unsub).toHaveBeenCalledOnce();
    expect(store.counts.L1).toBeUndefined();
  });

  it('stop closes every listener but keeps the last counts for the next visit', () => {
    const store = useListItemCountsStore();
    store.sync(['L1', 'L2']);
    listeners.get('L1')!.onChange([makeItem('I1')]);
    const first = listeners.get('L1')!.unsub;
    const second = listeners.get('L2')!.unsub;
    store.stop();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(store.counts.L1).toEqual({ itemCount: 1, urgentCount: 0 });
    store.sync(['L1']);
    expect(subscribeItems).toHaveBeenCalledTimes(3);
  });

  it('drops the count when a listener errors, so the card falls back', () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    listeners.get('L1')!.onChange([makeItem('I1')]);
    listeners.get('L1')!.onError(new Error('permission-denied'));
    expect(store.counts.L1).toBeUndefined();
  });

  it('forgets everything when the signed-in identity changes', async () => {
    const store = useListItemCountsStore();
    store.sync(['L1']);
    listeners.get('L1')!.onChange([makeItem('I1')]);
    const { unsub } = listeners.get('L1')!;
    auth.user = null;
    await nextTick();
    expect(unsub).toHaveBeenCalledOnce();
    expect(store.counts).toEqual({});
  });
});
