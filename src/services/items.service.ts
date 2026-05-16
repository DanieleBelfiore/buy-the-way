import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { Item, Category } from '@/domain/types';
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
}): Promise<ULID> => {
  const id = newId();
  const now = Date.now();
  const item: Item = {
    id,
    listId: params.listId,
    name: params.name,
    quantity: params.quantity,
    category: params.category,
    note: params.note,
    checked: false,
    createdByUid: params.createdByUid,
    createdAt: now,
    updatedAt: now,
  };

  const itemsCol = collection(db, 'lists', params.listId, 'items');
  await setDoc(doc(itemsCol, id), item);
  await upsertCatalogEntry(params.createdByUid, params.name, params.category);

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
};
