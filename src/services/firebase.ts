import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence — errors (e.g. multiple tabs, private browsing) are non-blocking.
try {
  await enableIndexedDbPersistence(db);
} catch (err) {
  console.warn('[firebase] IndexedDB persistence unavailable:', err);
}

// Connect to local emulators in dev mode (only once per process; try/catch guards HMR re-imports).
if (import.meta.env.DEV) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch {
    // Already connected — safe to ignore on hot-module reload.
  }
}
