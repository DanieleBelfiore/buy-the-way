import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/items.service', () => ({
  subscribeItems: vi.fn(),
}));

import { useItemsStore } from '@/stores/items';
import { subscribeItems } from '@/services/items.service';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const listId = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as ULID;
const listId2 = '01ARZ3NDEKTSV4RRFFQ69G5FB0' as ULID;

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FA1' as ULID,
  listId,
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

describe('useItemsStore', () => {
  let capturedOnChange: (items: Item[]) => void;
  let capturedOnError: (err: Error) => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(subscribeItems).mockImplementation((_id, onChange, onError) => {
      capturedOnChange = onChange;
      capturedOnError = onError;
      return vi.fn();
    });
  });

  it('starts with empty items, loading false, error null', () => {
    const store = useItemsStore();
    expect(store.items).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('setCurrentList calls subscribeItems with listId', () => {
    const store = useItemsStore();
    store.setCurrentList(listId);
    expect(subscribeItems).toHaveBeenCalledWith(listId, expect.any(Function), expect.any(Function));
  });

  it('sets loading true immediately on subscribe', () => {
    const store = useItemsStore();
    store.setCurrentList(listId);
    expect(store.loading).toBe(true);
  });

  it('populates items when onChange fires', () => {
    const store = useItemsStore();
    store.setCurrentList(listId);
    const items = [makeItem()];
    capturedOnChange(items);
    expect(store.items).toEqual(items);
    expect(store.loading).toBe(false);
  });

  it('sets error when onError fires', () => {
    const store = useItemsStore();
    store.setCurrentList(listId);
    capturedOnError(new Error('permission-denied'));
    expect(store.error).toBe('permission-denied');
    expect(store.loading).toBe(false);
  });

  it('unsubscribes previous list before subscribing new one', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    vi.mocked(subscribeItems).mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    const store = useItemsStore();
    store.setCurrentList(listId);
    store.setCurrentList(listId2);

    expect(unsub1).toHaveBeenCalledOnce();
    expect(subscribeItems).toHaveBeenCalledTimes(2);
  });

  it('setCurrentList(null) unsubscribes and clears items', () => {
    const unsub = vi.fn();
    vi.mocked(subscribeItems).mockReturnValue(unsub);

    const store = useItemsStore();
    store.setCurrentList(listId);
    capturedOnChange([makeItem()]);
    store.setCurrentList(null);

    expect(unsub).toHaveBeenCalledOnce();
    expect(store.items).toEqual([]);
    expect(subscribeItems).toHaveBeenCalledTimes(1);
  });

  describe('itemsByCategory', () => {
    it('returns empty map when no items', () => {
      const store = useItemsStore();
      expect(store.itemsByCategory.size).toBe(0);
    });

    it('groups items by category', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([
        makeItem({ id: '01A' as ULID, category: 'dairy', name: 'Latte' }),
        makeItem({ id: '01B' as ULID, category: 'bakery', name: 'Pane' }),
      ]);
      expect(store.itemsByCategory.has('dairy')).toBe(true);
      expect(store.itemsByCategory.has('bakery')).toBe(true);
      expect(store.itemsByCategory.get('dairy')).toHaveLength(1);
      expect(store.itemsByCategory.get('bakery')).toHaveLength(1);
    });

    it('omits empty categories from map', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([makeItem({ category: 'dairy' })]);
      expect(store.itemsByCategory.has('bakery')).toBe(false);
    });

    it('unchecked items come before checked within same category', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      const checked = makeItem({ id: '01A' as ULID, checked: true, createdAt: 1000 });
      const unchecked = makeItem({ id: '01B' as ULID, checked: false, createdAt: 2000 });
      capturedOnChange([checked, unchecked]);
      const items = store.itemsByCategory.get('dairy')!;
      expect(items[0].checked).toBe(false);
      expect(items[1].checked).toBe(true);
    });

    it('within unchecked, sorts by createdAt ascending', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([
        makeItem({ id: '01A' as ULID, checked: false, createdAt: 2000, name: 'Later' }),
        makeItem({ id: '01B' as ULID, checked: false, createdAt: 1000, name: 'Earlier' }),
      ]);
      const items = store.itemsByCategory.get('dairy')!;
      expect(items[0].name).toBe('Earlier');
      expect(items[1].name).toBe('Later');
    });

    it('within checked, sorts by createdAt ascending', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([
        makeItem({ id: '01A' as ULID, checked: true, createdAt: 3000, name: 'Later' }),
        makeItem({ id: '01B' as ULID, checked: true, createdAt: 1000, name: 'Earlier' }),
      ]);
      const items = store.itemsByCategory.get('dairy')!;
      expect(items[0].name).toBe('Earlier');
      expect(items[1].name).toBe('Later');
    });

    it('dairy appears before other in map key order (respects CATEGORY_ORDER)', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([
        makeItem({ id: '01A' as ULID, category: 'other', name: 'Misc' }),
        makeItem({ id: '01B' as ULID, category: 'dairy', name: 'Latte' }),
      ]);
      const keys = [...store.itemsByCategory.keys()];
      expect(keys.indexOf('dairy')).toBeLessThan(keys.indexOf('other'));
    });
  });
});
