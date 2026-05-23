import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { Item, Category, ItemPriority } from '@/domain/types';
import { capitalizeInitial } from '@/domain/text';
import { upsertCatalogEntry } from '@/services/catalog.service';

export const subscribeItems = (
  listId: ULID,
  onChange: (items: Item[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  const q = query(itemsCol, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
      onChange(items);
    },
    (error) => onError(error as Error),
  );
};

export const addItem = async (params: {
  listId: ULID;
  name: string;
  quantity: string;
  category: Category;
  note: string;
  createdByUid: string;
  priority?: ItemPriority;
}): Promise<ULID> => {
  const id = newId();
  const now = Date.now();
  const name = capitalizeInitial(params.name);
  const note = capitalizeInitial(params.note);
  const item: Item = {
    id,
    listId: params.listId,
    name,
    quantity: params.quantity,
    category: params.category,
    note,
    checked: false,
    createdByUid: params.createdByUid,
    createdAt: now,
    updatedAt: now,
    ...(params.priority ? { priority: params.priority } : {}),
  };

  const itemsCol = collection(db, 'lists', params.listId, 'items');
  await setDoc(doc(itemsCol, id), item);
  await updateDoc(doc(db, 'lists', params.listId), {
    itemCount: increment(1),
    updatedAt: now,
  });
  await upsertCatalogEntry(params.createdByUid, name, params.category);

  return id;
};

export const toggleChecked = async (
  listId: ULID,
  itemId: ULID,
  checked: boolean,
): Promise<void> => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  const now = Date.now();
  await updateDoc(doc(itemsCol, itemId), {
    checked,
    updatedAt: now,
  });
  // Bump parent list's updatedAt so lists sorted by recency reflect activity.
  // Rules allow any collaborator to touch only updatedAt (subset of itemCount+updatedAt branch).
  await updateDoc(doc(db, 'lists', listId), { updatedAt: now });
};

export const removeItem = async (listId: ULID, itemId: ULID): Promise<void> => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  await deleteDoc(doc(itemsCol, itemId));
  await updateDoc(doc(db, 'lists', listId), {
    itemCount: increment(-1),
    updatedAt: Date.now(),
  });
};

export interface ItemPatch {
  name?: string;
  quantity?: string;
  note?: string;
  category?: Category;
  priority?: ItemPriority | null;
}

export const updateItem = async (
  listId: ULID,
  itemId: ULID,
  patch: ItemPatch,
): Promise<void> => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  const now = Date.now();
  const payload: Record<string, unknown> = { ...patch, updatedAt: now };
  if (patch.name !== undefined) {
    payload.name = capitalizeInitial(patch.name);
  }
  if (patch.note !== undefined) {
    payload.note = capitalizeInitial(patch.note);
  }
  if (patch.priority === null) {
    payload.priority = deleteField();
  }
  await updateDoc(doc(itemsCol, itemId), payload);
  await updateDoc(doc(db, 'lists', listId), { updatedAt: now });
};

export const setItemPriority = async (
  listId: ULID,
  itemId: ULID,
  priority: ItemPriority | null,
): Promise<void> => {
  await updateItem(listId, itemId, { priority });
};

const buildCopiedItem = (
  src: Item,
  dstListId: ULID,
  byUid: string,
  name: string,
  now: number,
): Item => ({
  id: newId(),
  listId: dstListId,
  name,
  quantity: src.quantity,
  category: src.category,
  note: capitalizeInitial(src.note),
  checked: false,
  createdByUid: byUid,
  createdAt: now,
  updatedAt: now,
  ...(src.priority ? { priority: src.priority } : {}),
});

export const copyItem = async (
  item: Item,
  dstListId: ULID,
  byUid: string,
): Promise<ULID> => {
  const name = capitalizeInitial(item.name);
  const now = Date.now();
  const newItem = buildCopiedItem(item, dstListId, byUid, name, now);
  const dstItemsCol = collection(db, 'lists', dstListId, 'items');

  const batch = writeBatch(db);
  batch.set(doc(dstItemsCol, newItem.id), newItem);
  batch.update(doc(db, 'lists', dstListId), {
    itemCount: increment(1),
    updatedAt: now,
  });
  await batch.commit();

  await upsertCatalogEntry(byUid, name, item.category);
  return newItem.id;
};

export const moveItem = async (
  srcListId: ULID,
  item: Item,
  dstListId: ULID,
  byUid: string,
): Promise<ULID> => {
  const name = capitalizeInitial(item.name);
  const now = Date.now();
  const newItem = buildCopiedItem(item, dstListId, byUid, name, now);
  const srcItemsCol = collection(db, 'lists', srcListId, 'items');
  const dstItemsCol = collection(db, 'lists', dstListId, 'items');

  const batch = writeBatch(db);
  batch.set(doc(dstItemsCol, newItem.id), newItem);
  batch.delete(doc(srcItemsCol, item.id));
  batch.update(doc(db, 'lists', dstListId), {
    itemCount: increment(1),
    updatedAt: now,
  });
  batch.update(doc(db, 'lists', srcListId), {
    itemCount: increment(-1),
    updatedAt: now,
  });
  await batch.commit();

  await upsertCatalogEntry(byUid, name, item.category);
  return newItem.id;
};

const EMPTY_LIST_BATCH_SIZE = 500;

export const emptyList = async (listId: ULID, itemIds: ULID[]): Promise<void> => {
  if (itemIds.length === 0) return;
  const itemsCol = collection(db, 'lists', listId, 'items');
  for (let i = 0; i < itemIds.length; i += EMPTY_LIST_BATCH_SIZE) {
    const chunk = itemIds.slice(i, i + EMPTY_LIST_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) batch.delete(doc(itemsCol, id));
    await batch.commit();
  }
  await updateDoc(doc(db, 'lists', listId), {
    itemCount: 0,
    updatedAt: Date.now(),
  });
};
