import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { useItemsStore } from '@/stores/items';
import { useListsStore } from '@/stores/lists';

describe('stores/items', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.signOut();
    auth.signIn();
  });

  it('add appends a fresh item, sets owner + timestamps, and calls catalog.recordUse', () => {
    const lists = useListsStore();
    const items = useItemsStore();
    const catalog = useCatalogStore();
    const spy = vi.spyOn(catalog, 'recordUse');
    const listId = lists.create('Test');
    const before = items.forList(listId).length;
    const id = items.add(listId, {
      name: 'Bananas',
      quantity: '3',
      category: 'fruit_vegetables',
      note: '',
    });
    const after = items.forList(listId);
    expect(after.length).toBe(before + 1);
    const fresh = after.find((i) => i.id === id);
    expect(fresh).toBeDefined();
    expect(fresh?.checked).toBe(false);
    expect(fresh?.createdByUid).toBe('mock-uid');
    expect(spy).toHaveBeenCalledWith('Bananas', 'fruit_vegetables');
  });

  it('toggleChecked flips checked and bumps updatedAt', async () => {
    const lists = useListsStore();
    const items = useItemsStore();
    const listId = lists.create('Test');
    const id = items.add(listId, {
      name: 'Bread',
      quantity: '1',
      category: 'bakery',
      note: '',
    });
    const before = items.forList(listId).find((i) => i.id === id);
    expect(before?.checked).toBe(false);
    await new Promise((r) => setTimeout(r, 2));
    items.toggleChecked(listId, id);
    const mid = items.forList(listId).find((i) => i.id === id);
    expect(mid?.checked).toBe(true);
    expect(mid?.updatedAt ?? 0).toBeGreaterThan(before?.updatedAt ?? 0);
    items.toggleChecked(listId, id);
    expect(items.forList(listId).find((i) => i.id === id)?.checked).toBe(false);
  });

  it('toggleChecked is a no-op for unknown item ids', () => {
    const lists = useListsStore();
    const items = useItemsStore();
    const listId = lists.create('Test');
    const before = items.forList(listId);
    items.toggleChecked(listId, '01HXXXXXXXXXXXXXXXXXXXXXX0' as never);
    expect(items.forList(listId)).toEqual(before);
  });

  it('update merges a partial patch onto a single item', () => {
    const lists = useListsStore();
    const items = useItemsStore();
    const listId = lists.create('Test');
    const id = items.add(listId, {
      name: 'Milk',
      quantity: '1',
      category: 'dairy',
      note: '',
    });
    items.update(listId, id, { quantity: '2', note: 'fresh' });
    const after = items.forList(listId).find((i) => i.id === id);
    expect(after?.quantity).toBe('2');
    expect(after?.note).toBe('fresh');
    expect(after?.name).toBe('Milk');
  });

  it('remove deletes the item from its list', () => {
    const lists = useListsStore();
    const items = useItemsStore();
    const listId = lists.create('Test');
    const id = items.add(listId, {
      name: 'Eggs',
      quantity: '6',
      category: 'dairy',
      note: '',
    });
    items.remove(listId, id);
    expect(items.forList(listId).find((i) => i.id === id)).toBeUndefined();
  });

  it('forList returns an empty array for an unknown listId', () => {
    const items = useItemsStore();
    expect(items.forList('01HXXXXXXXXXXXXXXXXXXXXXX0' as never)).toEqual([]);
  });
});
