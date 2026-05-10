import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { recordCatalogUse } from './catalog.service';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

function itemDoc(listId: ULID, itemId: ULID) {
  return doc(db, 'lists', listId, 'items', itemId);
}

export async function addItem(listId: ULID, item: Item): Promise<void> {
  await setDoc(itemDoc(listId, item.id), { ...item });
  // fire-and-forget: catalog errors must not block item creation
  recordCatalogUse(item.createdByUid, item.name, item.category).catch(console.error);
}

export async function toggleChecked(
  listId: ULID,
  itemId: ULID,
  currentChecked: boolean,
): Promise<void> {
  await updateDoc(itemDoc(listId, itemId), { checked: !currentChecked, updatedAt: Date.now() });
}

export async function updateItem(
  listId: ULID,
  itemId: ULID,
  patch: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'note' | 'checked'>>,
): Promise<void> {
  await updateDoc(itemDoc(listId, itemId), { ...patch, updatedAt: Date.now() });
}

export async function removeItem(listId: ULID, itemId: ULID): Promise<void> {
  await deleteDoc(itemDoc(listId, itemId));
}

export function subscribeItems(listId: ULID, callback: (items: Item[]) => void): () => void {
  const q = query(collection(db, 'lists', listId, 'items'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Item));
  });
}
