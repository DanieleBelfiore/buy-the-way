import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: import.meta.env['VITE_FIREBASE_APP_ID'],
};

export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  // No popupRedirectResolver here on purpose: stops Firebase from eager-loading
  // the gapi iframe (__/auth/iframe.js) at boot, which sat on the LCP critical
  // path (~2.8s). The resolver is passed explicitly at the call sites in
  // auth.service.ts instead.
  //
  // Consequence: the SDK will NOT auto-complete a pending signInWithRedirect.
  // Installed PWAs use the redirect flow (popups never report back in iOS
  // standalone), so `consumeRedirectResult()` runs explicitly at boot in
  // main.ts. Do not drop that call when touching this block.
  //
  // The redirect flow also needs `authDomain` to be first-party: since
  // firebase-js-sdk 9.15 Safari's storage partitioning breaks redirect
  // sign-in when authDomain is <project>.firebaseapp.com. Production proxies
  // /__/auth/* through the app domain (see netlify.toml) and sets
  // VITE_FIREBASE_AUTH_DOMAIN to that domain. Local dev keeps the
  // firebaseapp.com value, since the vite dev server has no such proxy.
});
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);

if (import.meta.env['DEV'] && import.meta.env['VITE_USE_EMULATOR'] === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}
