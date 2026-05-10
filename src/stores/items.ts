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
import {
  addItem as addItemSvc,
  toggleChecked as toggleCheckedSvc,
  updateItem as updateItemSvc,
  removeItem as removeItemSvc,
  subscribeItems,
} from '@/services/items.service';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

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
  readonly loading: Ref<boolean>;
  readonly error: Ref<string | null>;
  add: (listId: ULID, draft: ItemDraft) => ULID;
  toggleChecked: (listId: ULID, itemId: ULID) => void;
  update: (listId: ULID, itemId: ULID, patch: ItemPatch) => void;
  remove: (listId: ULID, itemId: ULID) => void;
  subscribeToList: (listId: ULID) => () => void;
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

export const useItemsStore = defineStore('items', (): ItemsStoreApi => {
  const itemsByList: Ref<Readonly<Record<ULID, readonly Item[]>>> = ref(
    USE_FIXTURES ? cloneFixtures() : {},
  );
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);

  const forList = (listId: ULID): readonly Item[] => itemsByList.value[listId] ?? [];

  const _listUnsubs = new Map<ULID, () => void>();

  const subscribeToList = (listId: ULID): (() => void) => {
    if (USE_FIXTURES) return () => {};
    const existing = _listUnsubs.get(listId);
    if (existing) return existing;
    loading.value = true;
    const unsub = subscribeItems(listId, (items) => {
      itemsByList.value = { ...itemsByList.value, [listId]: items };
      loading.value = false;
    });
    _listUnsubs.set(listId, unsub);
    return () => {
      unsub();
      _listUnsubs.delete(listId);
    };
  };

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
    if (USE_FIXTURES) {
      itemsByList.value = updateList(itemsByList.value, listId, (current) => [...current, fresh]);
      catalog.recordUse(draft.name, draft.category);
    } else {
      addItemSvc(listId, fresh).catch((e) => {
        error.value = String(e);
      });
    }
    return id;
  };

  const patchItem = (listId: ULID, itemId: ULID, patch: ItemPatch): void => {
    const now = Date.now();
    itemsByList.value = updateList(itemsByList.value, listId, (current) =>
      current.map((i) => (i.id === itemId ? { ...i, ...patch, updatedAt: now } : i)),
    );
  };

  const toggleChecked = (listId: ULID, itemId: ULID): void => {
    if (USE_FIXTURES) {
      const current = itemsByList.value[listId] ?? [];
      const target = current.find((i) => i.id === itemId);
      if (!target) return;
      patchItem(listId, itemId, { checked: !target.checked });
    } else {
      const current = itemsByList.value[listId] ?? [];
      const target = current.find((i) => i.id === itemId);
      if (!target) return;
      toggleCheckedSvc(listId, itemId, target.checked).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const update = (listId: ULID, itemId: ULID, patch: ItemPatch): void => {
    if (USE_FIXTURES) {
      patchItem(listId, itemId, patch);
    } else {
      updateItemSvc(listId, itemId, patch).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const remove = (listId: ULID, itemId: ULID): void => {
    if (USE_FIXTURES) {
      itemsByList.value = updateList(itemsByList.value, listId, (current) =>
        current.filter((i) => i.id !== itemId),
      );
    } else {
      removeItemSvc(listId, itemId).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const reset = (): void => {
    _listUnsubs.forEach((unsub) => unsub());
    _listUnsubs.clear();
    itemsByList.value = USE_FIXTURES ? cloneFixtures() : {};
    loading.value = false;
    error.value = null;
  };

  return {
    itemsByList,
    forList,
    loading,
    error,
    add,
    toggleChecked,
    update,
    remove,
    subscribeToList,
    reset,
  };
});
