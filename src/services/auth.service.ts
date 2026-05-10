import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserProfile } from '@/domain/types';

const provider = new GoogleAuthProvider();

async function upsertUserProfile(uid: string, email: string, displayName: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { uid, email, displayName, lastLoginAt: Date.now() } satisfies UserProfile, {
    merge: true,
  });
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, provider);
  const { uid, email, displayName } = result.user;
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  await upsertUserProfile(uid, normalizedEmail, displayName ?? '');
  return {
    uid,
    email: normalizedEmail,
    displayName: displayName ?? '',
    lastLoginAt: Date.now(),
  };
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
