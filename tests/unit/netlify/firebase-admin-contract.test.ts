import { describe, it, expect } from 'vitest';

/**
 * Contract test against the REAL firebase-admin package - deliberately no
 * `vi.mock` anywhere in this file.
 *
 * Every other suite under tests/unit/netlify mocks firebase-admin, which means
 * they assert against a module shape we invented rather than the one npm
 * installed. That gap shipped a production outage: firebase-admin 14 removed
 * the legacy `admin.*` namespace, so `import admin from 'firebase-admin'` no
 * longer carries `apps` / `auth()` / `firestore()`. Every serverless function
 * died on `Cannot read properties of undefined (reading 'length')` while the
 * whole mocked suite stayed green.
 *
 * This file pins the exact imports the functions rely on. A breaking upgrade
 * now fails CI instead of production.
 */
describe('firebase-admin package contract', () => {
  it('exposes the app API used by initAdmin', async () => {
    const app = await import('firebase-admin/app');
    expect(typeof app.initializeApp).toBe('function');
    expect(typeof app.getApps).toBe('function');
    expect(typeof app.cert).toBe('function');
  });

  it('exposes getAuth, used for token verification and magic-link generation', async () => {
    const auth = await import('firebase-admin/auth');
    expect(typeof auth.getAuth).toBe('function');
  });

  it('exposes getFirestore, used by the rate limiter and the functions', async () => {
    const firestore = await import('firebase-admin/firestore');
    expect(typeof firestore.getFirestore).toBe('function');
  });
});
