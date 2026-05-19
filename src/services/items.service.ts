import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
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
  const item: Item = {
    id,
    listId: params.listId,
    name,
    quantity: params.quantity,
    category: params.category,
    note: params.note,
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
  await updateDoc(doc(itemsCol, itemId), {
    checked,
    updatedAt: Date.now(),
  });
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
  const payload: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
  if (patch.name !== undefined) {
    payload.name = capitalizeInitial(patch.name);
  }
  if (patch.priority === null) {
    payload.priority = deleteField();
  }
  await updateDoc(doc(itemsCol, itemId), payload);
};

export const setItemPriority = async (
  listId: ULID,
  itemId: ULID,
  priority: ItemPriority | null,
): Promise<void> => {
  await updateItem(listId, itemId, { priority });
};

export class DuplicateInDestinationError extends Error {
  constructor(name: string) {
    super(`An item named "${name}" already exists in the destination list`);
    this.name = 'DuplicateInDestinationError';
  }
}

const dstItemNamesLower = async (dstListId: ULID): Promise<Set<string>> => {
  const itemsCol = collection(db, 'lists', dstListId, 'items');
  const snap = await getDocs(itemsCol);
  return new Set(
    snap.docs.map((d) => String((d.data() as Item).name ?? '').toLowerCase()),
  );
};

export const copyItem = async (
  item: Item,
  dstListId: ULID,
  byUid: string,
): Promise<ULID> => {
  const lower = await dstItemNamesLower(dstListId);
  if (lower.has(item.name.toLowerCase())) {
    throw new DuplicateInDestinationError(item.name);
  }
  return addItem({
    listId: dstListId,
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    note: item.note,
    createdByUid: byUid,
    priority: item.priority,
  });
};

export const moveItem = async (
  srcListId: ULID,
  item: Item,
  dstListId: ULID,
  byUid: string,
): Promise<ULID> => {
  const newId_ = await copyItem(item, dstListId, byUid);
  await removeItem(srcListId, item.id);
  return newId_;
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
