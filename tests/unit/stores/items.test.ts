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

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(subscribeItems).mockImplementation((_id, onChange, _onError) => {
      capturedOnChange = onChange;
      return vi.fn();
    });
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

  describe('itemsByCategory', () => {
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
  });

  describe('pending-delete buffer (S3.1)', () => {
    it('marked item disappears from visibleItems while remaining in items', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([
        makeItem({ id: '01A' as ULID, name: 'Latte' }),
        makeItem({ id: '01B' as ULID, name: 'Pane', category: 'bakery' }),
      ]);
      expect(store.visibleItems).toHaveLength(2);

      store.markPendingDelete('01A' as ULID);
      expect(store.visibleItems).toHaveLength(1);
      expect(store.visibleItems.map((i) => i.id)).toEqual(['01B']);
      // Underlying firestore snapshot is untouched.
      expect(store.items).toHaveLength(2);
    });

    it('unmarkPendingDelete restores the row to visibleItems', () => {
      const store = useItemsStore();
      store.setCurrentList(listId);
      capturedOnChange([makeItem({ id: '01A' as ULID, name: 'Latte' })]);
      store.markPendingDelete('01A' as ULID);
      expect(store.visibleItems).toHaveLength(0);
      store.unmarkPendingDelete('01A' as ULID);
      expect(store.visibleItems).toHaveLength(1);
    });
  });
});
