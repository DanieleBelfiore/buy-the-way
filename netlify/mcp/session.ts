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

/**
 * Re-uses the current sign-in when it already belongs to `uid`; otherwise
 * mints a custom token (claim `via: 'mcp'`) and signs in with it. Requires
 * the default firebase-admin app to be initialised by the caller.
 */
export const ensureSignedIn = async (uid: string): Promise<void> => {
  if (auth.currentUser?.uid === uid) return;
  const token = await getAdminAuth().createCustomToken(uid, { via: 'mcp' });
  await signInWithCustomToken(auth, token);
};
