import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import { findUserByEmail } from '@/services/users.service';
import { isWallpaper, pickRandomWallpaper } from '@/domain/wallpapers';
import { capitalizeInitial } from '@/domain/text';
import type { List, UserProfile } from '@/domain/types';

export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`No registered user with email: ${email}`);
    this.name = 'UserNotFoundError';
  }
}

export class CannotRemoveOwnerError extends Error {
  constructor() {
    super('The list owner cannot be removed');
    this.name = 'CannotRemoveOwnerError';
  }
}

export class ListNotFoundError extends Error {
  constructor(listId: string) {
    super(`List not found: ${listId}`);
    this.name = 'ListNotFoundError';
  }
}

export class DuplicateListNameError extends Error {
  constructor(name: string) {
    super(`A list named "${name}" already exists`);
    this.name = 'DuplicateListNameError';
  }
}

export class InvalidWallpaperError extends Error {
  constructor(value: string) {
    super(`Invalid wallpaper filename: ${value}`);
    this.name = 'InvalidWallpaperError';
  }
}

const normalizeListName = (name: string): string => name.trim().toLowerCase();

export const capitalizeListName = capitalizeInitial;

export const createList = async (
  name: string,
  ownerUid: string,
  existingNames: readonly string[] = [],
): Promise<string> => {
  const formatted = capitalizeListName(name);
  const target = normalizeListName(formatted);
  if (target && existingNames.some((n) => normalizeListName(n) === target)) {
    throw new DuplicateListNameError(formatted);
  }
  const id = newId();
  const now = Date.now();
  const listData: List = {
    id,
    name: formatted,
    ownerUid,
    collaboratorUids: [ownerUid],
    itemCount: 0,
    wallpaper: pickRandomWallpaper(),
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'lists', id), listData);
  return id;
};

export const setListWallpaper = async (
  listId: string,
  wallpaper: string,
): Promise<void> => {
  if (!isWallpaper(wallpaper)) throw new InvalidWallpaperError(wallpaper);
  await updateDoc(doc(db, 'lists', listId), {
    wallpaper,
    updatedAt: Date.now(),
  });
};

export const subscribeUserLists = (
  uid: string,
  onChange: (lists: List[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  const q = query(
    collection(db, 'lists'),
    where('collaboratorUids', 'array-contains', uid),
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

export const addCollaborator = async (
  listId: string,
  email: string,
): Promise<UserProfile> => {
  const profile = await findUserByEmail(email);
  if (!profile) throw new UserNotFoundError(email);

  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayUnion(profile.uid),
    updatedAt: Date.now(),
  });
  return profile;
};

const loadListOwner = async (listId: string): Promise<string> => {
  const snap = await getDoc(doc(db, 'lists', listId));
  if (!snap.exists()) throw new ListNotFoundError(listId);
  return (snap.data() as List).ownerUid;
};

export const removeCollaborator = async (
  listId: string,
  uid: string,
): Promise<void> => {
  const ownerUid = await loadListOwner(listId);
  if (uid === ownerUid) throw new CannotRemoveOwnerError();

  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayRemove(uid),
    updatedAt: Date.now(),
  });
};

export const leaveList = async (listId: string, selfUid: string): Promise<void> => {
  const ownerUid = await loadListOwner(listId);
  if (selfUid === ownerUid) throw new CannotRemoveOwnerError();

  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayRemove(selfUid),
    updatedAt: Date.now(),
  });
};

export const renameList = async (listId: string, name: string): Promise<void> => {
  const formatted = capitalizeListName(name);
  if (!formatted) throw new Error('List name cannot be empty');
  await updateDoc(doc(db, 'lists', listId), {
    name: formatted,
    updatedAt: Date.now(),
  });
};

export const setListShowFavorites = async (
  listId: string,
  showFavorites: boolean,
): Promise<void> => {
  await updateDoc(doc(db, 'lists', listId), {
    showFavorites,
    updatedAt: Date.now(),
  });
};

export const transferListOwnership = async (
  listId: string,
  oldOwnerUid: string,
  newOwnerUid: string,
): Promise<void> => {
  if (oldOwnerUid === newOwnerUid) {
    throw new Error('Cannot transfer ownership to the same user');
  }
  await updateDoc(doc(db, 'lists', listId), {
    ownerUid: newOwnerUid,
    collaboratorUids: arrayRemove(oldOwnerUid),
    updatedAt: Date.now(),
  });
};

const DELETE_BATCH_SIZE = 500;

export const deleteList = async (listId: string): Promise<void> => {
  const itemsCol = collection(db, 'lists', listId, 'items');
  const snap = await getDocs(itemsCol);
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const chunk = ids.slice(i, i + DELETE_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) batch.delete(doc(itemsCol, id));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'lists', listId));
};
