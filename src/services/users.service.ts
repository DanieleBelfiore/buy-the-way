import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  where,
  deleteField,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/services/firebase';
import type { UserProfile } from '@/domain/types';

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export type FindUserErrorCode =
  | 'empty_email'
  | 'unauthenticated'
  | 'transport'
  | 'http';

export class FindUserError extends Error {
  constructor(public readonly code: FindUserErrorCode, message: string) {
    super(message);
    this.name = 'FindUserError';
  }
}

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
  if (!normalized) throw new FindUserError('empty_email', 'findUserByEmail: empty email');

  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new FindUserError('unauthenticated', 'findUserByEmail: not authenticated');

  let res: Response;
  try {
    const idToken = await user.getIdToken();
    res = await fetch(`/.netlify/functions/find-user?email=${encodeURIComponent(normalized)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (err) {
    throw new FindUserError(
      'transport',
      `findUserByEmail: transport error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    throw new FindUserError('http', `findUserByEmail: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { profile: UserProfile | null };
  return data.profile;
};

/**
 * User-doc layout (post-C3 hardening):
 *
 *   users/{uid}                          ← PUBLIC profile
 *     uid, email, displayName, photoURL?
 *
 *   users/{uid}/private/state            ← PRIVATE activity / preferences
 *     lastLoginAt, lastSeenLists, lastSeenListMap, defaultListId
 *
 * Only the owner can read or write the `private` subcollection (rules
 * enforced). The top-level doc remains readable by any signed-in user so
 * collaborator avatars / displayName resolution still work, but no longer
 * carries activity metadata.
 *
 * `getUserProfile` reads BOTH locations and merges, with a fallback to
 * legacy top-level fields for users whose doc predates the migration. The
 * migration runs once per cold sign-in (see `auth.service.onAuthChanged`)
 * and strips the legacy fields from the top-level doc as it goes.
 */

const privateStateRef = (uid: string) =>
  doc(db, 'users', uid, 'private', 'state');

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const [topSnap, privSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(privateStateRef(uid)).catch(() => null),
  ]);
  if (!topSnap.exists()) return null;
  const top = topSnap.data() as Partial<UserProfile>;
  const priv = (privSnap?.exists() ? (privSnap.data() as Partial<UserProfile>) : {}) ?? {};

  const profile: UserProfile = {
    uid: top.uid ?? uid,
    email: top.email ?? '',
    displayName: top.displayName ?? '',
    lastLoginAt: priv.lastLoginAt ?? top.lastLoginAt ?? 0,
  };
  if (top.photoURL) profile.photoURL = top.photoURL;
  const lastSeenLists = priv.lastSeenLists ?? top.lastSeenLists;
  if (lastSeenLists !== undefined) profile.lastSeenLists = lastSeenLists;
  const lastSeenListMap = priv.lastSeenListMap ?? top.lastSeenListMap;
  if (lastSeenListMap !== undefined) profile.lastSeenListMap = lastSeenListMap;
  const defaultListId = priv.defaultListId ?? top.defaultListId;
  if (defaultListId !== undefined) profile.defaultListId = defaultListId;
  return profile;
};

export const touchLastSeenLists = async (
  uid: string,
  timestamp: number = Date.now(),
): Promise<void> => {
  await setDoc(privateStateRef(uid), { lastSeenLists: timestamp }, { merge: true });
};

/**
 * Mark a single list as seen by the user at `timestamp` (defaults to now).
 * Writes to the private subcollection; deep-merges with any existing
 * per-list entries.
 */
export const touchLastSeenList = async (
  uid: string,
  listId: string,
  timestamp: number = Date.now(),
): Promise<void> => {
  await setDoc(
    privateStateRef(uid),
    { lastSeenListMap: { [listId]: timestamp } },
    { merge: true },
  );
};

/**
 * Set the user's default list. Pass `null` to clear (no auto-redirect at boot).
 * Writes to the private subcollection so cross-user reads of `users/{uid}`
 * cannot infer which list the target user has pinned as default.
 */
export const setUserDefaultList = async (
  uid: string,
  listId: string | null,
): Promise<void> => {
  await setDoc(privateStateRef(uid), { defaultListId: listId }, { merge: true });
};

/**
 * One-shot migration helper: copy any legacy private fields living on the
 * top-level user doc into the private subcollection, then strip them from
 * the top-level. Safe to call on every sign-in — a no-op once migrated.
 *
 * Returns the set of keys that were migrated (for logging/tests).
 */
export const migrateLegacyPrivateFields = async (uid: string): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  const LEGACY_KEYS = ['lastLoginAt', 'lastSeenLists', 'lastSeenListMap', 'defaultListId'] as const;
  const migrate: Record<string, unknown> = {};
  const strip: Record<string, unknown> = {};
  for (const k of LEGACY_KEYS) {
    if (k in data) {
      migrate[k] = data[k];
      strip[k] = deleteField();
    }
  }
  const keys = Object.keys(migrate);
  if (keys.length === 0) return [];
  await setDoc(privateStateRef(uid), migrate, { merge: true });
  await setDoc(doc(db, 'users', uid), strip, { merge: true });
  return keys;
};

export const deletePrivateState = async (uid: string): Promise<void> => {
  try {
    await deleteDoc(privateStateRef(uid));
  } catch (err) {
    // Best-effort: missing doc is fine. Wrapped so a transient failure
    // doesn't block account-delete on the auth side.
    console.warn('[users] deletePrivateState failed (continuing):', err);
  }
};

// Firestore caps `documentId() in [...]` at 30 values per query. Chunk and
// run in parallel to fetch up to N profiles with ceil(N/30) round trips,
// instead of N independent getDoc calls.
const USERS_IN_CHUNK = 30;

export const getUsersByUids = async (
  uids: readonly string[],
): Promise<UserProfile[]> => {
  if (uids.length === 0) return [];
  const unique = Array.from(new Set(uids));
  const usersCol = collection(db, 'users');

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += USERS_IN_CHUNK) {
    chunks.push(unique.slice(i, i + USERS_IN_CHUNK));
  }

  const snaps = await Promise.all(
    chunks.map((chunk) => getDocs(query(usersCol, where(documentId(), 'in', chunk)))),
  );

  const out: UserProfile[] = [];
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const data = d.data() as UserProfile;
      // Only the public profile is needed for collaborator avatars / cards.
      // Activity metadata (lastLoginAt, lastSeenLists, lastSeenListMap,
      // defaultListId) is intentionally NOT returned — see C3 hardening.
      out.push({
        uid: data.uid ?? d.id,
        email: data.email ?? '',
        displayName: data.displayName ?? '',
        lastLoginAt: 0,
        ...(data.photoURL ? { photoURL: data.photoURL } : {}),
      });
    }
  }
  return out;
};
