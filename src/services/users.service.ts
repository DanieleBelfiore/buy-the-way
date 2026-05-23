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

import { getAuth } from 'firebase/auth';

export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const idToken = await user.getIdToken();
    const res = await fetch(`/.netlify/functions/find-user?email=${encodeURIComponent(normalized)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      console.warn('[findUserByEmail] HTTP error', res.status);
      return null;
    }

    const data = await res.json() as { profile: UserProfile | null };
    return data.profile;
  } catch (err) {
    console.error('[findUserByEmail] Network error', err);
    return null;
  }
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
    ...(data.lastSeenListMap !== undefined && { lastSeenListMap: data.lastSeenListMap }),
    ...(data.photoURL && { photoURL: data.photoURL }),
    ...(data.defaultListId !== undefined && { defaultListId: data.defaultListId }),
  };
};

export const touchLastSeenLists = async (
  uid: string,
  timestamp: number = Date.now(),
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { lastSeenLists: timestamp }, { merge: true });
};

/**
 * Mark a single list as seen by the user at `timestamp` (defaults to now).
 * Uses `setDoc({merge:true})` so the per-list map is deep-merged with any
 * existing entries instead of being overwritten.
 */
export const touchLastSeenList = async (
  uid: string,
  listId: string,
  timestamp: number = Date.now(),
): Promise<void> => {
  await setDoc(
    doc(db, 'users', uid),
    { lastSeenListMap: { [listId]: timestamp } },
    { merge: true },
  );
};

/**
 * Set the user's default list. Pass `null` to clear (no auto-redirect at boot).
 * Merges with the existing user document so other profile fields stay intact.
 */
export const setUserDefaultList = async (
  uid: string,
  listId: string | null,
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { defaultListId: listId }, { merge: true });
};

export const getUsersByUids = async (
  uids: readonly string[],
): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const unique = Array.from(new Set(uids));
  const settled = await Promise.all(unique.map((uid) => getUserProfile(uid)));
  return settled.filter((p): p is UserProfile => p !== null);
};
