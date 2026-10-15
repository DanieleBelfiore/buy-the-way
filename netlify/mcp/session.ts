import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/services/firebase';

/**
 * Signs the per-container client SDK in as the calling user, so every
 * Firestore / Storage call from src/services runs under that user's rules.
 *
 * One client app per container (netlify/mcp/firebase-node.ts) is shared by
 * all requests, so requests are serialized: a second user must never run
 * while the first one's tool call is still in flight. A Lambda container
 * serves one invocation at a time anyway; the queue makes that explicit.
 */

let queue: Promise<unknown> = Promise.resolve();

/** Runs `task` after every previously queued task has settled. */
export const serialized = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};

/** The token's user no longer exists in Firebase Auth (account deleted). */
export class UserGoneError extends Error {
  constructor(uid: string) {
    super(`auth user ${uid} does not exist`);
    this.name = 'UserGoneError';
  }
}

/**
 * Re-uses the current sign-in when it already belongs to `uid`; otherwise
 * mints a custom token (claim `via: 'mcp'`) and signs in with it. Requires
 * the default firebase-admin app to be initialised by the caller.
 *
 * Signing in with a custom token creates the Auth user when it is missing,
 * so the uid is checked first: an assistant still holding a token after the
 * account was deleted must not bring it back (throws UserGoneError).
 */
export const ensureSignedIn = async (uid: string): Promise<void> => {
  if (auth.currentUser?.uid === uid) return;
  try {
    await getAdminAuth().getUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/user-not-found') throw new UserGoneError(uid);
    throw err;
  }
  const token = await getAdminAuth().createCustomToken(uid, { via: 'mcp' });
  await signInWithCustomToken(auth, token);
};
