import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from '@/domain/types';

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const normalized = email.trim().toLowerCase();
  const q = query(collection(db, 'users'), where('email', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return snap.docs[0]!.data() as UserProfile;
}
