import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/services/firebase';
import type { UserProfile } from '@/domain/types';

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

/**
 * Look up a user by their canonical (trimmed, lowercased) email.
 *
 * Returns `null` only when the lookup succeeded and no matching account
 * exists (the server-side `find-user` function returned `{ profile: null }`).
 *
 * Throws on:
 *   - empty / unauthenticated caller state (cannot mint an ID token)
 *   - transport failures (network down, fetch rejected)
 *   - non-2xx HTTP responses
 *
 * Callers driving an invite flow rely on this distinction to tell the user
 * "no such account" vs "we couldn't check right now — try again".
 */
export const findUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('findUserByEmail: empty email');

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('findUserByEmail: not authenticated');

  const idToken = await user.getIdToken();
  const res = await fetch(`/.netlify/functions/find-user?email=${encodeURIComponent(normalized)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    throw new Error(`findUserByEmail: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { profile: UserProfile | null };
  return data.profile;
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
