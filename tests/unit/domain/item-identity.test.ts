import { describe, it, expect } from 'vitest';
import {
  itemIdentityKey,
  duplicateItemIds,
  favoritePresenceKey,
  favoritePresenceKeys,
  itemPresenceKey,
  suggestionMatchesListItem,
} from '@/domain/item-identity';
import type { Item } from '@/domain/types';

const baseItem = (overrides: Partial<Item> = {}): Item => ({
  id: overrides.id ?? '01ITEM0001',
  listId: '01LIST0001',
  name: overrides.name ?? 'Latte',
  quantity: overrides.quantity ?? '',
  category: overrides.category ?? 'dairy',
  note: overrides.note ?? '',
  checked: false,
  createdByUid: 'u1',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('item-identity', () => {
  it('itemIdentityKey ignores name casing', () => {
    const a = baseItem({ name: 'Latte' });
    const b = baseItem({ id: '02', name: 'latte' });
    expect(itemIdentityKey(a)).toBe(itemIdentityKey(b));
  });

  it('itemIdentityKey includes note, quantity, and photo url', () => {
    const plain = baseItem();
    const rich = baseItem({
      id: '02',
      quantity: '2L',
      note: 'intero',
      thumbURL: 'https://x/thumb.jpg',
    });
    expect(itemIdentityKey(plain)).not.toBe(itemIdentityKey(rich));
  });

  it('duplicateItemIds marks only items in groups of 2+ exact matches', () => {
    const a = baseItem({ id: 'a' });
    const b = baseItem({ id: 'b' });
    const c = baseItem({ id: 'c', name: 'Pane', category: 'bakery' });
    const dupes = duplicateItemIds([a, b, c]);
    expect(dupes.has('a')).toBe(true);
    expect(dupes.has('b')).toBe(true);
    expect(dupes.has('c')).toBe(false);
  });

  it('favoritePresenceKeys tracks slug+category pairs on the list', () => {
    const keys = favoritePresenceKeys([
      baseItem({ name: 'Latte', category: 'dairy' }),
      baseItem({ id: '2', name: 'Pane', category: 'bakery' }),
    ]);
    expect(keys.has(favoritePresenceKey('latte', 'dairy'))).toBe(true);
    expect(keys.has(itemPresenceKey(baseItem({ name: 'Pane', category: 'bakery' })))).toBe(true);
  });

  it('suggestionMatchesListItem matches plain catalog picks only', () => {
    const items = [
      baseItem({ name: 'Latte', category: 'dairy' }),
      baseItem({ id: '2', name: 'Latte', category: 'dairy', note: 'bio' }),
    ];
    expect(suggestionMatchesListItem(items, { name: 'Latte', category: 'dairy' })).toBe(true);
    expect(suggestionMatchesListItem(items, { name: 'Pane', category: 'bakery' })).toBe(false);
  });
});
