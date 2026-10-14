import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

/**
 * Node replacement for `src/services/firebase.ts`, wired in through a module
 * alias on `@/services/firebase` (vitest.mcp.config.ts, and the MCP function
 * bundle). It exports the same `app` / `auth` / `db` / `storage` singletons,
 * so `src/services/*` run unchanged inside a Netlify Function.
 *
 * Why not reuse the browser module: it reads `import.meta.env` (Vite only)
 * and asks for IndexedDB persistence, neither of which exists in Node.
 *
 * The client SDK is used on purpose instead of firebase-admin: the function
 * signs in as the calling user (custom token), so Firestore and Storage rules
 * stay the only access check. See tasks/mcp-plan.md.
 *
 * One app per process is safe because a Lambda container serves one
 * invocation at a time; the MCP handler also serializes requests.
 */

// Static `process.env.X` reads on purpose: vite.mcp.config.ts inlines them
// at build time from the CI's VITE_FIREBASE_* secrets (public web config),
// and only a literal member access can be replaced that way.
const required = (value: string | undefined, key: string): string => {
  if (!value) throw new Error(`${key} env var is not set`);
  return value;
};

const splitHost = (hostPort: string): [string, number] => {
  const [host, port] = hostPort.split(':');
  return [host ?? '127.0.0.1', Number(port)];
};

export const app = initializeApp({
  apiKey: required(process.env.FIREBASE_WEB_API_KEY, 'FIREBASE_WEB_API_KEY'),
  projectId: required(process.env.FIREBASE_PROJECT_ID, 'FIREBASE_PROJECT_ID'),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  appId: process.env.FIREBASE_APP_ID,
});
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export const storage = getStorage(app);

// Same variables `firebase emulators:exec` exports and firebase-admin reads.
const authEmulator = process.env['FIREBASE_AUTH_EMULATOR_HOST'];
const firestoreEmulator = process.env['FIRESTORE_EMULATOR_HOST'];
const storageEmulator = process.env['FIREBASE_STORAGE_EMULATOR_HOST'];
if (authEmulator) connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
if (firestoreEmulator) connectFirestoreEmulator(db, ...splitHost(firestoreEmulator));
if (storageEmulator) connectStorageEmulator(storage, ...splitHost(storageEmulator));
