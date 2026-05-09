/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { Category, Item } from '@/domain/types';
import { FIXTURE_ITEMS } from '@/dev/fixtures';
import { useAuthStore } from './auth';
import { useCatalogStore } from './catalog';

export interface ItemDraft {
  readonly name: string;
  readonly quantity: string;
  readonly category: Category;
  readonly note: string;
}

export type ItemPatch = Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'checked'>>;

interface ItemsStoreApi {
  readonly itemsByList: Ref<Readonly<Record<ULID, readonly Item[]>>>;
  readonly forList: (listId: ULID) => readonly Item[];
  add: (listId: ULID, draft: ItemDraft) => ULID;
  toggleChecked: (listId: ULID, itemId: ULID) => void;
  update: (listId: ULID, itemId: ULID, patch: ItemPatch) => void;
  remove: (listId: ULID, itemId: ULID) => void;
  reset: () => void;
}

const FALLBACK_OWNER = 'mock-uid';

const cloneFixtures = (): Record<ULID, readonly Item[]> => {
  const out: Record<ULID, readonly Item[]> = {};
  for (const [listId, items] of Object.entries(FIXTURE_ITEMS) as [ULID, readonly Item[]][]) {
    out[listId] = items.map((i) => ({ ...i }));
  }
  return out;
};

const updateList = (
  source: Readonly<Record<ULID, readonly Item[]>>,
  listId: ULID,
  fn: (current: readonly Item[]) => readonly Item[],
): Record<ULID, readonly Item[]> => ({
  ...source,
  [listId]: fn(source[listId] ?? []),
});

/**
 * Items keyed by parent list. Mutations always return new arrays so Vue's
 * reactivity catches the change without `$patch` tricks. {@link add} fires
 * `catalog.recordUse` so the MostUsedShelf reflects new entries instantly.
 */
export const useItemsStore = defineStore('items', (): ItemsStoreApi => {
  const itemsByList: Ref<Readonly<Record<ULID, readonly Item[]>>> = ref(cloneFixtures());

  const forList = (listId: ULID): readonly Item[] => itemsByList.value[listId] ?? [];

  const add = (listId: ULID, draft: ItemDraft): ULID => {
    const auth = useAuthStore();
    const catalog = useCatalogStore();
    const createdByUid = auth.currentUser?.uid ?? FALLBACK_OWNER;
    const now = Date.now();
    const id = newId();
    const fresh: Item = {
      id,
      listId,
      name: draft.name,
      quantity: draft.quantity,
      category: draft.category,
      note: draft.note,
      checked: false,
      createdByUid,
      createdAt: now,
      updatedAt: now,
    };
    itemsByList.value = updateList(itemsByList.value, listId, (current) => [...current, fresh]);
    catalog.recordUse(draft.name, draft.category);
    return id;
  };

  const patchItem = (listId: ULID, itemId: ULID, patch: ItemPatch): void => {
    const now = Date.now();
    itemsByList.value = updateList(itemsByList.value, listId, (current) =>
      current.map((i) => (i.id === itemId ? { ...i, ...patch, updatedAt: now } : i)),
    );
  };

  const toggleChecked = (listId: ULID, itemId: ULID): void => {
    const current = itemsByList.value[listId] ?? [];
    const target = current.find((i) => i.id === itemId);
    if (!target) {
      return;
    }
    patchItem(listId, itemId, { checked: !target.checked });
  };

  const update = (listId: ULID, itemId: ULID, patch: ItemPatch): void => {
    patchItem(listId, itemId, patch);
  };

  const remove = (listId: ULID, itemId: ULID): void => {
    itemsByList.value = updateList(itemsByList.value, listId, (current) =>
      current.filter((i) => i.id !== itemId),
    );
  };

  const reset = (): void => {
    itemsByList.value = cloneFixtures();
  };

  return { itemsByList, forList, add, toggleChecked, update, remove, reset };
});
