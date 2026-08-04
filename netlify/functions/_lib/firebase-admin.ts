import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';

/**
 * Lazily initialise the default firebase-admin app from env. Idempotent.
 *
 * Uses the modular `firebase-admin/*` subpaths, never the legacy namespace
 * default import. firebase-admin 14 dropped the `admin.apps` / `admin.auth()` /
 * `admin.firestore()` namespace, so `import admin from 'firebase-admin'` now
 * resolves to the App API alone and every namespace access throws
 * `Cannot read properties of undefined (reading 'length')` at runtime. Unit
 * tests do not catch it: mocking 'firebase-admin' fabricates a module shape
 * the real package no longer has. Keep the subpath imports.
 */
export const initAdmin = (): void => {
  if (getApps().length > 0) return;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const serviceAccount = JSON.parse(raw) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
};
