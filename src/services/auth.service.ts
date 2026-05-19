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

  // 2 + 3. For each list:
  //   - non-owner collaborator → leaveList
  //   - owner of shared list (≥1 other collaborator) → transfer ownership to next collaborator
  //   - owner of solo list → deleteList
  // Best-effort: per-list failure is logged + skipped.
  for (const docSnap of listsSnap.docs) {
    const data = docSnap.data() as {
      ownerUid?: string;
      collaboratorUids?: string[];
    };
    const listId = docSnap.id;
    try {
      if (data.ownerUid === uid) {
        const others = (data.collaboratorUids ?? []).filter((u) => u !== uid);
        if (others.length > 0) {
          await transferListOwnership(listId, uid, others[0]!);
        } else {
          await deleteList(listId);
        }
      } else {
        await leaveList(listId, uid);
      }
    } catch (err) {
      console.warn('[auth] deleteAccount: list cleanup failed', listId, err);
    }
  }

  // 4. Purge catalog entries.
  try {
    await purgeCatalog(uid);
  } catch (err) {
    console.warn('[auth] deleteAccount: catalog purge failed', err);
  }

  // 5. Delete user doc.
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('[auth] deleteAccount: user doc delete failed', err);
  }

  // 6. Delete Firebase Auth user — hard requirement.
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
