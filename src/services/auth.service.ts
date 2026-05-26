import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  reauthenticateWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { claimPendingInvites, deleteList, leaveList, transferListOwnership } from '@/services/lists.service';
import { migrateLegacyPrivateFields, deletePrivateState } from '@/services/users.service';
import { deleteAllNotifications } from '@/services/notifications.service';
import type { AuthUser } from '@/composables/useAuth';

export class RequiresRecentLoginError extends Error {
  constructor() {
    super('requires-recent-login');
    this.name = 'RequiresRecentLoginError';
  }
}

export class NoCurrentUserError extends Error {
  constructor() {
    super('No current user');
    this.name = 'NoCurrentUserError';
  }
}

export class PartialDeletionError extends Error {
  constructor(public readonly failures: ReadonlyArray<string>) {
    super(`Account data could not be fully deleted (${failures.length} failure(s))`);
    this.name = 'PartialDeletionError';
  }
}

export const signInWithGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};

// localStorage key used by Firebase's recommended magic-link flow to remember
// which email requested the link, so the callback page can complete sign-in
// without re-prompting (and without trusting the URL alone).
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'btw:magicLinkEmail';

/**
 * Compute the URL Firebase should send the user back to after they click the
 * magic-link in their inbox. Anchored on `window.location.origin` so it works
 * for both dev (localhost:5173) and prod without hardcoding hosts.
 */
const magicLinkContinueUrl = (): string =>
  `${window.location.origin}/auth/email-link-callback`;

/**
 * S2.3: request a sign-in link by email. Firebase sends the actual email via
 * its own infra (no Resend dep), the user clicks the link and is bounced to
 * `magicLinkContinueUrl` which completes sign-in via
 * `completeMagicLinkSignIn`. Persists the email locally so we don't have to
 * trust the link's query string to identify the recipient.
 */
export const sendMagicLink = async (email: string): Promise<void> => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('sendMagicLink: empty email');
  await sendSignInLinkToEmail(auth, normalized, {
    url: magicLinkContinueUrl(),
    handleCodeInApp: true,
  });
  try {
    window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, normalized);
  } catch {
    // Storage unavailable (Safari private mode, quota) - sign-in still works
    // because the callback page will fall back to asking for the email again.
  }
};

/** True when the current URL is a Firebase magic-link callback. */
export const isMagicLinkCallback = (url: string = window.location.href): boolean =>
  isSignInWithEmailLink(auth, url);

/**
 * Complete the sign-in started by `sendMagicLink`. Reads the requesting email
 * from localStorage; if missing (e.g. the link was opened on a different
 * device than the one that requested it), the caller must pass `emailHint`.
 *
 * Returns the freshly authenticated user's uid so the caller can finish the
 * navigation flow.
 */
export const completeMagicLinkSignIn = async (
  url: string = window.location.href,
  emailHint?: string,
): Promise<string> => {
  let email = emailHint?.trim().toLowerCase() ?? '';
  if (!email) {
    try {
      email = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY) ?? '';
    } catch {
      email = '';
    }
  }
  if (!email) throw new Error('completeMagicLinkSignIn: missing email');

  const credential = await signInWithEmailLink(auth, email, url);
  try {
    window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
  } catch {
    // Best-effort cleanup.
  }
  return credential.user.uid;
};

const DELETE_BATCH_SIZE = 500;

const purgeCatalog = async (uid: string): Promise<void> => {
  const entriesCol = collection(db, 'catalog', uid, 'entries');
  const snap = await getDocs(entriesCol);
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const chunk = refs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
  }
};

export const reauthenticateGoogle = async (): Promise<void> => {
  const current = auth.currentUser;
  if (!current) throw new NoCurrentUserError();
  const provider = new GoogleAuthProvider();
  await reauthenticateWithPopup(current, provider);
};

export const deleteAccount = async (uid: string): Promise<void> => {
  const current = auth.currentUser;
  if (!current) throw new NoCurrentUserError();

  // 1. Enumerate lists where uid is a collaborator.
  const listsQuery = query(
    collection(db, 'lists'),
    where('collaboratorUids', 'array-contains', uid),
  );
  const listsSnap = await getDocs(listsQuery);

  // 2 + 3. For each list (parallel, best-effort):
  //   - non-owner collaborator → leaveList
  //   - owner of shared list (≥1 other collaborator) → transfer ownership to next collaborator (lexicographic)
  //   - owner of solo list → deleteList
  const failures: string[] = [];

  const listResults = await Promise.allSettled(
    listsSnap.docs.map(async (docSnap) => {
      const data = docSnap.data() as {
        ownerUid?: string;
        collaboratorUids?: string[];
      };
      const listId = docSnap.id;
      if (data.ownerUid === uid) {
        // Deterministic next-owner pick: lexicographic order, independent of array storage order.
        const others = (data.collaboratorUids ?? []).filter((u) => u !== uid).sort();
        if (others.length === 0) {
          await deleteList(listId);
        } else {
          await transferListOwnership(listId, uid, others[0]!);
        }
      } else {
        await leaveList(listId, uid);
      }
      return listId;
    }),
  );

  listResults.forEach((res, idx) => {
    if (res.status === 'rejected') {
      const listId = listsSnap.docs[idx]?.id ?? 'unknown';
      console.warn('[auth] deleteAccount: list cleanup failed', listId, res.reason);
      failures.push(`list:${listId}`);
    }
  });

  // 4. Purge catalog entries.
  try {
    await purgeCatalog(uid);
  } catch (err) {
    console.warn('[auth] deleteAccount: catalog purge failed', err);
    failures.push('catalog');
  }

  // 5a. Purge private subcollection (lastLoginAt + activity state) and the
  // in-app notifications inbox. Best-effort: continues on failure so a
  // missing/orphan doc doesn't block the rest of the cascade.
  await deletePrivateState(uid);
  await deleteAllNotifications(uid);

  // 5b. Delete user doc.
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('[auth] deleteAccount: user doc delete failed', err);
    failures.push('userDoc');
  }

  // 6. If any Firestore cleanup failed, surface BEFORE deleting the Auth user.
  // Auth-user deletion is irreversible and the orphaned data would become unreachable.
  if (failures.length > 0) {
    throw new PartialDeletionError(failures);
  }

  // 7. Delete Firebase Auth user - hard requirement, only when data is gone.
  try {
    await current.delete();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/requires-recent-login') {
      throw new RequiresRecentLoginError();
    }
    throw err;
  }
};

export const signOutCurrent = (): Promise<void> => signOut(auth);

// Tracks the uid we last saw a non-null state for, so we can debounce the
// upsert + invite-claim work to "actual sign-in transitions" rather than
// firing on every token-refresh / tab-focus event.
let _lastSeenUid: string | null = null;

export const onAuthChanged = (
  callback: (user: AuthUser | null) => void,
): (() => void) => {
  return _onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const isNewSignIn = _lastSeenUid !== firebaseUser.uid;
      _lastSeenUid = firebaseUser.uid;

      // Only do the heavyweight work (profile upsert with lastLoginAt + invite
      // claim) on actual sign-in transitions. Token refreshes / focus events
      // fire the same callback but with the same uid - skip the writes there.
      if (isNewSignIn) {
        const publicProfile = {
          uid: firebaseUser.uid,
          email: (firebaseUser.email ?? '').toLowerCase().trim(),
          displayName: firebaseUser.displayName ?? '',
          ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
        };
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), publicProfile, { merge: true });
        } catch (err) {
          // Non-fatal - profile upsert fails if Firestore is unavailable,
          // but auth state is still valid and the guard must resolve.
          console.warn('[auth] Failed to upsert user profile:', err);
        }

        // C3 migration: if this user predates the schema split, move any
        // legacy private fields (lastLoginAt/lastSeenLists/lastSeenListMap/
        // defaultListId) off the publicly-readable top-level doc into the
        // owner-only private subcollection. One-shot; subsequent sign-ins
        // see no legacy keys and return immediately.
        try {
          await migrateLegacyPrivateFields(firebaseUser.uid);
        } catch (err) {
          console.warn('[auth] Legacy private-field migration failed:', err);
        }

        // Private state (lastLoginAt) lives in the per-user private
        // subcollection so it doesn't leak through cross-user profile reads.
        try {
          await setDoc(
            doc(db, 'users', firebaseUser.uid, 'private', 'state'),
            { lastLoginAt: Date.now() },
            { merge: true },
          );
        } catch (err) {
          console.warn('[auth] Failed to upsert private state:', err);
        }

        // Claim any lists where this user was invited by email before they
        // had an account. Failures are logged inside the service; don't block
        // sign-in if the claim can't proceed.
        if (publicProfile.email) {
          void claimPendingInvites(firebaseUser.uid, publicProfile.email);
        }
      }

      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
      });
    } else {
      _lastSeenUid = null;
      callback(null);
    }
  });
};

/** Test-only escape hatch: reset the module-level uid tracker between tests. */
export const __resetAuthLastSeenUid = (): void => {
  _lastSeenUid = null;
};
