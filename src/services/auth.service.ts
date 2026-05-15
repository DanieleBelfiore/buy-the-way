import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as _onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { AuthUser } from '@/composables/useAuth';
import type { UserProfile } from '@/domain/types';

export const signInWithGoogle = async (): Promise<void> => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
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
