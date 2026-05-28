import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit as fbLimit,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { Item, ListHistoryEntry } from '@/domain/types';
import { HISTORY_MAX_ENTRIES, type ListHistoryTrigger } from '@/domain/history';

const snapshotItems = (items: readonly Item[]): Item[] =>
  items.map((item) => ({ ...item }));

export const recordListHistory = async (
  listId: ULID,
  items: readonly Item[],
  recordedByUid: string,
  trigger: ListHistoryTrigger,
): Promise<ULID | null> => {
  if (items.length === 0) return null;
  const id = newId();
  const now = Date.now();
  const entry: ListHistoryEntry = {
    id,
    listId,
    completedAt: now,
    itemCount: items.length,
    recordedByUid,
    trigger,
    items: snapshotItems(items),
  };
  const col = collection(db, 'lists', listId, 'history');
  await setDoc(doc(col, id), entry);
  await pruneListHistory(listId);
  return id;
};

/**
 * Read the newest completed-shopping snapshots for a list, newest first.
 * Default limit matches {@link HISTORY_MAX_ENTRIES} (the stored cap).
 */
export const fetchListHistory = async (
  listId: ULID,
  opts?: { limit?: number },
): Promise<ListHistoryEntry[]> => {
  const cap = Math.min(
    Math.max(1, opts?.limit ?? HISTORY_MAX_ENTRIES),
    HISTORY_MAX_ENTRIES,
  );
  const col = collection(db, 'lists', listId, 'history');
  const snap = await getDocs(
    query(col, orderBy('completedAt', 'desc'), fbLimit(cap)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ListHistoryEntry);
};

/** Drop oldest entries when a list exceeds {@link HISTORY_MAX_ENTRIES}. */
export const pruneListHistory = async (listId: ULID): Promise<void> => {
  const col = collection(db, 'lists', listId, 'history');
  const snap = await getDocs(query(col, orderBy('completedAt', 'desc')));
  if (snap.docs.length <= HISTORY_MAX_ENTRIES) return;
  const excess = snap.docs.slice(HISTORY_MAX_ENTRIES);
  for (let i = 0; i < excess.length; i += 500) {
    const chunk = excess.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
  }
};

export const deleteAllListHistory = async (listId: ULID): Promise<void> => {
  const col = collection(db, 'lists', listId, 'history');
  const snap = await getDocs(col);
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const chunk = snap.docs.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
  }
};
