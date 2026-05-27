import {
  collection,
  doc,
  getDoc,
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
import { countUrgentItems, isUrgentPriority } from '@/domain/priority';
import { upsertCatalogEntry } from '@/services/catalog.service';
import { upsertListFavorite } from '@/services/listFavorites.service';
import { notifyListEvent } from '@/services/notify.service';
import { purgeItemPhotoStorage } from '@/services/itemPhotos.service';

const listCounterUpdate = (opts: {
  itemDelta?: number;
  urgentDelta?: number;
  now?: number;
}): Record<string, unknown> => {
  const patch: Record<string, unknown> = { updatedAt: opts.now ?? Date.now() };
  if (opts.itemDelta) patch.itemCount = increment(opts.itemDelta);
  if (opts.urgentDelta) patch.urgentCount = increment(opts.urgentDelta);
  return patch;
};

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

  // Atomic: item write + parent itemCount bump succeed or fail together.
  // Catalog + favorite upserts are denormalised caches; if they fail the row
  // still exists and the user is unblocked. Errors are logged so the drift
  // is observable rather than silent.
  const batch = writeBatch(db);
  batch.set(doc(itemsCol, id), item);
  batch.update(doc(db, 'lists', params.listId), listCounterUpdate({
    itemDelta: 1,
    urgentDelta: isUrgentPriority(params.priority) ? 1 : undefined,
    now,
  }));
  await batch.commit();

  try {
    await upsertCatalogEntry(params.createdByUid, name, params.category);
  } catch (err) {
    console.warn('[items] addItem: catalog upsert failed (item still added):', err);
  }
  try {
    await upsertListFavorite(params.listId, name, params.category);
  } catch (err) {
    console.warn('[items] addItem: favorite upsert failed (item still added):', err);
  }



  return id;
};

// Slot reserved per batch for the parent-list `itemCount += N` update.
// Firestore caps batches at 500 ops, so each chunk fits 499 item sets + 1
// list update => self-contained atomic batch.
const BULK_ADD_BATCH_SIZE = 499;

export interface BulkAddRow {
  name: string;
  category: Category;
  quantity?: string;
  note?: string;
  priority?: ItemPriority;
}

/**
 * Add many items to one list in one (or more) atomic batches.
 *
 * - Each batch contains N item writes + the matching `itemCount += N`
 *   increment on the parent list. If the batch fails, neither the items nor
 *   the counter are touched - no drift.
 * - Catalog + favorite upserts run AFTER each batch commits, best-effort.
 *
 * Returns the array of created item IDs in the same order as `rows`.
 */
export const bulkAddItems = async (params: {
  listId: ULID;
  rows: BulkAddRow[];
  createdByUid: string;
}): Promise<ULID[]> => {
  const { listId, rows, createdByUid } = params;
  if (rows.length === 0) return [];

  const itemsCol = collection(db, 'lists', listId, 'items');
  const listRef = doc(db, 'lists', listId);
  const ids: ULID[] = [];
  // Buffer of (name, category) pairs to forward to catalog/favorite upserts
  // once each batch commits. Capitalisation applied here so the cache reflects
  // exactly what was persisted.
  const committed: Array<{ name: string; category: Category }> = [];

  for (let i = 0; i < rows.length; i += BULK_ADD_BATCH_SIZE) {
    const chunk = rows.slice(i, i + BULK_ADD_BATCH_SIZE);
    const batch = writeBatch(db);
    const now = Date.now();

    for (const row of chunk) {
      const id = newId();
      ids.push(id);
      const name = capitalizeInitial(row.name);
      const note = capitalizeInitial(row.note ?? '');
      const item: Item = {
        id,
        listId,
        name,
        quantity: row.quantity ?? '',
        category: row.category,
        note,
        checked: false,
        createdByUid,
        createdAt: now,
        updatedAt: now,
        ...(row.priority ? { priority: row.priority } : {}),
      };
      batch.set(doc(itemsCol, id), item);
      committed.push({ name, category: row.category });
    }

    batch.update(listRef, listCounterUpdate({
      itemDelta: chunk.length,
      urgentDelta: countUrgentItems(chunk) || undefined,
      now,
    }));

    await batch.commit();
  }

  // Best-effort cache updates after the authoritative writes have landed.
  // Failures here leave the items intact and only degrade autocomplete/favs.
  await Promise.all(
    committed.map(async ({ name, category }) => {
      try {
        await upsertCatalogEntry(createdByUid, name, category);
      } catch (err) {
        console.warn('[items] bulkAddItems: catalog upsert failed:', err);
      }
      try {
        await upsertListFavorite(listId, name, category);
      } catch (err) {
        console.warn('[items] bulkAddItems: favorite upsert failed:', err);
      }
    }),
  );



  return ids;
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

/** Bulk-set the `checked` flag on N items in chunked atomic batches. */
export const bulkToggleChecked = async (
  listId: ULID,
  itemIds: ULID[],
  checked: boolean,
): Promise<void> => {
  if (itemIds.length === 0) return;
  const itemsCol = collection(db, 'lists', listId, 'items');
  const listRef = doc(db, 'lists', listId);
  const CHUNK = 499;
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const chunk = itemIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    const now = Date.now();
    for (const id of chunk) {
      batch.update(doc(itemsCol, id), { checked, updatedAt: now });
    }
    batch.update(listRef, { updatedAt: now });
    await batch.commit();
  }
};

export const removeItem = async (listId: ULID, itemId: ULID): Promise<void> => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  const itemRef = doc(itemsCol, itemId);
  const snap = await getDoc(itemRef);
  const wasUrgent = isUrgentPriority(snap.data()?.priority as ItemPriority | undefined);
  await deleteDoc(itemRef);
  await updateDoc(doc(db, 'lists', listId), listCounterUpdate({
    itemDelta: -1,
    urgentDelta: wasUrgent ? -1 : undefined,
  }));
  // I1: cascade-purge any attached Storage objects. The doc is already
  // gone so we skip the doc-patch step (purgeItemPhotoStorage). Best-
  // effort: items without a photo are no-ops; transient Storage failures
  // are logged but never propagate (firestore delete already committed).
  void purgeItemPhotoStorage(listId, itemId).catch(() => undefined);
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

  let listPatch = listCounterUpdate({});
  if (patch.priority !== undefined) {
    const snap = await getDoc(doc(itemsCol, itemId));
    const prev = snap.data()?.priority as ItemPriority | undefined;
    const next = patch.priority;
    const wasUrgent = isUrgentPriority(prev);
    const willBeUrgent = isUrgentPriority(next);
    if (wasUrgent && !willBeUrgent) {
      listPatch = listCounterUpdate({ urgentDelta: -1 });
    } else if (!wasUrgent && willBeUrgent) {
      listPatch = listCounterUpdate({ urgentDelta: 1 });
    }
  }

  await updateDoc(doc(itemsCol, itemId), payload);
  await updateDoc(doc(db, 'lists', listId), listPatch);

  void notifyListEvent({
    listId,
    kind: 'item-modified',
    itemId,
  });
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
  batch.update(doc(db, 'lists', dstListId), listCounterUpdate({
    itemDelta: 1,
    urgentDelta: isUrgentPriority(item.priority) ? 1 : undefined,
    now,
  }));
  await batch.commit();

  await upsertCatalogEntry(byUid, name, item.category);
  await upsertListFavorite(dstListId, name, item.category);
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
  batch.update(doc(db, 'lists', dstListId), listCounterUpdate({
    itemDelta: 1,
    urgentDelta: isUrgentPriority(item.priority) ? 1 : undefined,
    now,
  }));
  batch.update(doc(db, 'lists', srcListId), listCounterUpdate({
    itemDelta: -1,
    urgentDelta: isUrgentPriority(item.priority) ? -1 : undefined,
    now,
  }));
  await batch.commit();

  await upsertCatalogEntry(byUid, name, item.category);
  await upsertListFavorite(dstListId, name, item.category);
  return newItem.id;
};

// S3.2: bulk operations. Each batch reserves slots for the parent-list
// `itemCount` update(s); chunk sizes are picked to stay inside Firestore's
// 500-op batch cap while keeping every commit atomic with its counter bump.

/** Delete N items from one list in chunked atomic batches. */
export const bulkRemoveItems = async (
  listId: ULID,
  itemIds: ULID[],
  opts?: { urgentRemoved?: number },
): Promise<void> => {
  if (itemIds.length === 0) return;
  const itemsCol = collection(db, 'lists', listId, 'items');
  const listRef = doc(db, 'lists', listId);
  const urgentRemoved = opts?.urgentRemoved ?? 0;
  // 499 deletes + 1 list-update per batch.
  const CHUNK = 499;
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const chunk = itemIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const id of chunk) batch.delete(doc(itemsCol, id));
    batch.update(listRef, listCounterUpdate({
      itemDelta: -chunk.length,
      urgentDelta: i === 0 && urgentRemoved ? -urgentRemoved : undefined,
    }));
    await batch.commit();
  }

  // I1: cascade-purge Storage objects for every deleted item. The docs are
  // already gone so we go straight to Storage (skip the doc-patch step).
  void Promise.all(
    itemIds.map((id) => purgeItemPhotoStorage(listId, id).catch(() => undefined)),
  );


};

/**
 * Copy N items into a destination list. Each chunk is one batch: N item
 * writes + 1 dst itemCount bump.
 */
export const bulkCopyItems = async (
  items: Item[],
  dstListId: ULID,
  byUid: string,
): Promise<ULID[]> => {
  if (items.length === 0) return [];
  const dstItemsCol = collection(db, 'lists', dstListId, 'items');
  const dstListRef = doc(db, 'lists', dstListId);
  const CHUNK = 499;
  const ids: ULID[] = [];
  // Buffer for catalog/favorite cache refreshes after each batch commits.
  const committed: Array<{ name: string; category: Category }> = [];

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    const now = Date.now();
    for (const src of chunk) {
      const name = capitalizeInitial(src.name);
      const newItem = buildCopiedItem(src, dstListId, byUid, name, now);
      batch.set(doc(dstItemsCol, newItem.id), newItem);
      ids.push(newItem.id);
      committed.push({ name, category: src.category });
    }
    batch.update(dstListRef, listCounterUpdate({
      itemDelta: chunk.length,
      urgentDelta: countUrgentItems(chunk) || undefined,
      now,
    }));
    await batch.commit();
  }

  await Promise.all(
    committed.map(async ({ name, category }) => {
      try { await upsertCatalogEntry(byUid, name, category); } catch (err) {
        console.warn('[items] bulkCopyItems: catalog upsert failed:', err);
      }
      try { await upsertListFavorite(dstListId, name, category); } catch (err) {
        console.warn('[items] bulkCopyItems: favorite upsert failed:', err);
      }
    }),
  );
  return ids;
};

/**
 * Move N items from src to dst list. Each chunk batches: N set + N delete +
 * 2 list-update (src -, dst +). 498 items per chunk so the 500-op cap is
 * respected (498*2 + 2 = 998 ... wait - too many). Actually: per item we
 * need 1 set (in dst) + 1 delete (from src). That's 2 ops per item, plus
 * 2 counter ops per batch. So max items per batch = floor((500 - 2) / 2) = 249.
 */
export const bulkMoveItems = async (
  srcListId: ULID,
  items: Item[],
  dstListId: ULID,
  byUid: string,
): Promise<ULID[]> => {
  if (items.length === 0) return [];
  const srcItemsCol = collection(db, 'lists', srcListId, 'items');
  const dstItemsCol = collection(db, 'lists', dstListId, 'items');
  const srcListRef = doc(db, 'lists', srcListId);
  const dstListRef = doc(db, 'lists', dstListId);
  const CHUNK = 249;
  const ids: ULID[] = [];
  const committed: Array<{ name: string; category: Category }> = [];

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    const now = Date.now();
    for (const src of chunk) {
      const name = capitalizeInitial(src.name);
      const newItem = buildCopiedItem(src, dstListId, byUid, name, now);
      batch.set(doc(dstItemsCol, newItem.id), newItem);
      batch.delete(doc(srcItemsCol, src.id));
      ids.push(newItem.id);
      committed.push({ name, category: src.category });
    }
    const urgentInChunk = countUrgentItems(chunk);
    batch.update(dstListRef, listCounterUpdate({
      itemDelta: chunk.length,
      urgentDelta: urgentInChunk || undefined,
      now,
    }));
    batch.update(srcListRef, listCounterUpdate({
      itemDelta: -chunk.length,
      urgentDelta: urgentInChunk ? -urgentInChunk : undefined,
      now,
    }));
    await batch.commit();
  }

  await Promise.all(
    committed.map(async ({ name, category }) => {
      try { await upsertCatalogEntry(byUid, name, category); } catch (err) {
        console.warn('[items] bulkMoveItems: catalog upsert failed:', err);
      }
      try { await upsertListFavorite(dstListId, name, category); } catch (err) {
        console.warn('[items] bulkMoveItems: favorite upsert failed:', err);
      }
    }),
  );
  return ids;
};

// Reserve one slot per batch for the parent-list update so each chunk is a
// self-contained, atomic write. Firestore caps a batch at 500 ops.
const EMPTY_LIST_BATCH_SIZE = 499;

export const emptyList = async (
  listId: ULID,
  itemIds: ULID[],
  opts?: { urgentRemoved?: number },
): Promise<void> => {
  if (itemIds.length === 0) return;
  const itemsCol = collection(db, 'lists', listId, 'items');
  const listRef = doc(db, 'lists', listId);
  const urgentRemoved = opts?.urgentRemoved ?? 0;
  for (let i = 0; i < itemIds.length; i += EMPTY_LIST_BATCH_SIZE) {
    const chunk = itemIds.slice(i, i + EMPTY_LIST_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) batch.delete(doc(itemsCol, id));
    // Decrement by the chunk size in the SAME batch as the deletes - if the
    // batch fails the count is untouched, if it succeeds the deletes and the
    // counter move together. Avoids the previous "items still present but
    // itemCount=0" inconsistency on partial failure.
    batch.update(listRef, listCounterUpdate({
      itemDelta: -chunk.length,
      urgentDelta: i === 0 && urgentRemoved ? -urgentRemoved : undefined,
    }));
    await batch.commit();
  }
  // I1: cascade-purge Storage photos. Docs are already gone so we skip the
  // doc-patch step. Independent fire-and-forget delete per item so a
  // Storage outage never blocks the firestore commit.
  void Promise.all(
    itemIds.map((id) => purgeItemPhotoStorage(listId, id).catch(() => undefined)),
  );
};
