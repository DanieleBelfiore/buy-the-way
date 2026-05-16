import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { UserProfile } from '@/domain/types';

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const q = query(
    collection(db, 'users'),
    where('email', '==', normalized),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const data = docSnap.data() as UserProfile;
  return {
    uid: data.uid ?? docSnap.id,
    email: data.email,
    displayName: data.displayName ?? '',
    lastLoginAt: data.lastLoginAt ?? 0,
    ...(data.lastSeenLists !== undefined && { lastSeenLists: data.lastSeenLists }),
  };
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfile;
  return {
    uid: data.uid ?? uid,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    lastLoginAt: data.lastLoginAt ?? 0,
    ...(data.lastSeenLists !== undefined && { lastSeenLists: data.lastSeenLists }),
  };
};

export const touchLastSeenLists = async (
  uid: string,
  timestamp: number = Date.now(),
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { lastSeenLists: timestamp }, { merge: true });
};

export const getUsersByUids = async (
  uids: readonly string[],
): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const unique = Array.from(new Set(uids));
  const settled = await Promise.all(unique.map((uid) => getUserProfile(uid)));
  return settled.filter((p): p is UserProfile => p !== null);
};
