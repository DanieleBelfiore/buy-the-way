import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  reauthenticateWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
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
import { deleteList, leaveList, transferListOwnership } from '@/services/lists.service';
import type { AuthUser } from '@/composables/useAuth';
import type { UserProfile } from '@/domain/types';

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

  // 5. Delete user doc.
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

  // 7. Delete Firebase Auth user — hard requirement, only when data is gone.
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

export const onAuthChanged = (
  callback: (user: AuthUser | null) => void,
): (() => void) => {
  return _onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email: (firebaseUser.email ?? '').toLowerCase().trim(),
        displayName: firebaseUser.displayName ?? '',
        lastLoginAt: Date.now(),
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
      };
      try {
        await setDoc(doc(db, 'users', firebaseUser.uid), profile, { merge: true });
      } catch (err) {
        // Non-fatal — profile upsert fails if Firestore is unavailable,
        // but auth state is still valid and the guard must resolve.
        console.warn('[auth] Failed to upsert user profile:', err);
      }
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
      });
    } else {
      callback(null);
    }
  });
};
