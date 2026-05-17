import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { Category, CatalogEntry } from '@/domain/types';

export const subscribeCatalog = (
  ownerUid: string,
  onChange: (entries: CatalogEntry[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  const entriesCol = collection(db, 'catalog', ownerUid, 'entries');
  return onSnapshot(
    entriesCol,
    (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CatalogEntry);
      onChange(entries);
    },
    (error) => onError(error as Error),
  );
};

export const upsertCatalogEntry = async (
  ownerUid: string,
  name: string,
  category: Category,
): Promise<void> => {
  const entriesCol = collection(db, 'catalog', ownerUid, 'entries');
  const q = query(entriesCol, where('name', '==', name));
  const snap = await getDocs(q);

  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, {
      usageCount: increment(1),
      lastUsedAt: Date.now(),
    });
  } else {
    const id = newId();
    const entry: CatalogEntry = {
      id,
      ownerUid,
      name,
      category,
      usageCount: 1,
      lastUsedAt: Date.now(),
    };
    await setDoc(doc(entriesCol, id), entry);
  }
};

export const setCatalogPinned = async (
  ownerUid: string,
  entryId: ULID,
  pinned: boolean,
): Promise<void> => {
  const entriesCol = collection(db, 'catalog', ownerUid, 'entries');
  const patch: Record<string, unknown> = { pinned };
  if (pinned) patch.excluded = false;
  await updateDoc(doc(entriesCol, entryId), patch);
};

export const setCatalogExcluded = async (
  ownerUid: string,
  entryId: ULID,
  excluded: boolean,
): Promise<void> => {
  const entriesCol = collection(db, 'catalog', ownerUid, 'entries');
  const patch: Record<string, unknown> = { excluded };
  if (excluded) patch.pinned = false;
  await updateDoc(doc(entriesCol, entryId), patch);
};

export const findCatalogEntryByName = async (
  ownerUid: string,
  name: string,
): Promise<CatalogEntry | null> => {
  const entriesCol = collection(db, 'catalog', ownerUid, 'entries');
  const q = query(entriesCol, where('name', '==', name));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const first = snap.docs[0]!;
  return { id: first.id, ...first.data() } as CatalogEntry;
};
