import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { findUserByEmail } from './users.service';
import type { List } from '@/domain/types';
import type { ULID } from '@/domain/id';

export class UserNotRegisteredError extends Error {
  constructor(email: string) {
    super(`No user registered with email: ${email}`);
    this.name = 'UserNotRegisteredError';
  }
}

export async function createList(list: List): Promise<void> {
  const ref = doc(db, 'lists', list.id);
  await setDoc(ref, { ...list, collaboratorUids: [...list.collaboratorUids] });
}

export async function renameList(id: ULID, name: string): Promise<void> {
  await updateDoc(doc(db, 'lists', id), { name, updatedAt: Date.now() });
}

export async function softDeleteList(id: ULID): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, 'lists', id), { deletedAt: now, updatedAt: now });
}

export async function restoreList(id: ULID): Promise<void> {
  await updateDoc(doc(db, 'lists', id), { deletedAt: null, updatedAt: Date.now() });
}

export async function addCollaboratorByUid(listId: ULID, uid: string): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayUnion(uid),
    updatedAt: Date.now(),
  });
}

export async function addCollaborator(listId: ULID, email: string): Promise<void> {
  const profile = await findUserByEmail(email);
  if (!profile) throw new UserNotRegisteredError(email);
  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayUnion(profile.uid),
    updatedAt: Date.now(),
  });
}

export async function removeCollaborator(listId: ULID, uid: string): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayRemove(uid),
    updatedAt: Date.now(),
  });
}

export async function leaveList(listId: ULID, selfUid: string): Promise<void> {
  return removeCollaborator(listId, selfUid);
}

export function subscribeUserLists(uid: string, callback: (lists: List[]) => void): () => void {
  const q = query(
    collection(db, 'lists'),
    where('ownerUid', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as List));
  });
}
