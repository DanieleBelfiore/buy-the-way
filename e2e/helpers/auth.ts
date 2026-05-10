/**
 * Auth helpers for E2E tests against the Firebase Auth emulator.
 * Creates a test user via the emulator REST API and injects a signed-in
 * localStorage state so specs can skip the OAuth flow.
 */
import type { Page } from '@playwright/test';

const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_EMULATOR = 'http://localhost:8080';
const PROJECT_ID = 'buy-the-way';
const FAKE_API_KEY = 'fake-api-key';

export interface TestUser {
  uid: string;
  email: string;
  idToken: string;
}

async function signUp(email: string, password: string): Promise<TestUser> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { localId: string; idToken: string };
  return { uid: data.localId, email, idToken: data.idToken };
}

async function signIn(email: string, password: string): Promise<TestUser> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { localId: string; idToken: string };
  return { uid: data.localId, email, idToken: data.idToken };
}

export async function createEmulatorUser(email: string, password = 'test1234!'): Promise<TestUser> {
  try {
    return await signUp(email, password);
  } catch {
    return signIn(email, password);
  }
}

export async function injectAuthState(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.evaluate(
    ({ uid, email, idToken, apiKey }) => {
      const key = `firebase:authUser:${apiKey}:[DEFAULT]`;
      const authObj = {
        uid,
        email,
        displayName: email.split('@')[0],
        photoURL: null,
        emailVerified: true,
        isAnonymous: false,
        providerData: [
          {
            providerId: 'google.com',
            uid: email,
            email,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
          },
        ],
        stsTokenManager: {
          refreshToken: 'fake-refresh',
          accessToken: idToken,
          expirationTime: Date.now() + 3_600_000,
        },
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        apiKey,
        appName: '[DEFAULT]',
      };
      localStorage.setItem(key, JSON.stringify(authObj));
    },
    { ...user, apiKey: FAKE_API_KEY },
  );
  await page.reload();
}

export async function clearEmulatorData(): Promise<void> {
  await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  ).catch(() => null);
  await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  }).catch(() => null);
}
