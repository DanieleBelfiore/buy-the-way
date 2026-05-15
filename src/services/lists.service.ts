import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import type { List } from '@/domain/types';

export const createList = async (name: string, ownerUid: string): Promise<string> => {
  const id = newId();
  const now = Date.now();
  const listData: List = {
    id,
    name,
    ownerUid,
    collaboratorUids: [ownerUid],
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'lists', id), listData);
  return id;
};

export const subscribeUserLists = (
  uid: string,
  onChange: (lists: List[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  const q = query(
    collection(db, 'lists'),
    where('collaboratorUids', 'array-contains', uid),
    where('deletedAt', '==', null),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const lists = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as List,
      );
      onChange(lists);
    },
    (error) => onError(error as Error),
  );
};
