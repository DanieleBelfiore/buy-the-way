import { normalizeName } from '@/domain/public-catalog';
import type { Category, Item } from '@/domain/types';

export type ItemIdentityFields = Pick<
  Item,
  'name' | 'category' | 'note' | 'quantity' | 'photoURL' | 'thumbURL'
>;

/** Stable fingerprint for exact-duplicate detection within a list. */
export const itemIdentityKey = (item: ItemIdentityFields): string => {
  const photo = item.thumbURL ?? item.photoURL ?? '';
  return [
    normalizeName(item.name),
    item.category,
    item.note.trim(),
    item.quantity.trim(),
    photo,
  ].join('|');
};

/** Keys shared by more than one visible item (exact duplicates). */
export const duplicateItemIds = (items: readonly Item[]): ReadonlySet<string> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = itemIdentityKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const item of items) {
    if ((counts.get(itemIdentityKey(item)) ?? 0) > 1) dupes.add(item.id);
  }
  return dupes;
};

/** Favorite tile presence: normalized name + category already on the list. */
export const favoritePresenceKey = (slug: string, category: Category): string =>
  `${slug}|${category}`;

export const itemPresenceKey = (item: Pick<Item, 'name' | 'category'>): string =>
  favoritePresenceKey(normalizeName(item.name), item.category);

export const favoritePresenceKeys = (items: readonly Item[]): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const item of items) keys.add(itemPresenceKey(item));
  return keys;
};
