import admin from 'firebase-admin';

/** Lazily initialise the default firebase-admin app from env. Idempotent. */
export const initAdmin = (): void => {
  if (admin.apps.length > 0) return;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
};
