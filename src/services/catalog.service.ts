import { collection, doc, increment, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import type { CatalogEntry } from '@/domain/types';

export async function recordCatalogUse(
  ownerUid: string,
  name: string,
  category: string,
): Promise<void> {
  const nameLower = name.toLowerCase();
  const ref = doc(db, 'catalog', `${ownerUid}_${nameLower}_${category}`);
  await setDoc(ref, { ownerUid, name, category, usageCount: increment(1) }, { merge: true });
}

export function subscribeCatalog(
  uid: string,
  callback: (entries: CatalogEntry[]) => void,
): () => void {
  const q = query(collection(db, 'catalog'), where('ownerUid', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as CatalogEntry));
  });
}
