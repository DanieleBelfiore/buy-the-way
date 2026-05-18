/**
 * E2E test bridge — exposes Firebase auth helpers on `window.__btw`
 * so Playwright specs can bypass the Google sign-in popup.
 *
 * Loaded only when `VITE_E2E=true`. Never bundled in production.
 */
import { GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '@/services/firebase';

const base64UrlEncode = (input: string): string => {
  const b64 = typeof btoa === 'function' ? btoa(input) : Buffer.from(input).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const buildFakeIdToken = (claims: Record<string, unknown>): string => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${header}.${payload}.`;
};

declare global {
  interface Window {
    __btw?: {
      signIn: (email: string, displayName: string) => Promise<string>;
      signOut: () => Promise<void>;
      currentUid: () => string | null;
    };
  }
}

window.__btw = {
  async signIn(email: string, displayName: string): Promise<string> {
    const sub = `e2e-${email}`;
    const idToken = buildFakeIdToken({
      sub,
      email,
      email_verified: true,
      name: displayName,
      aud: 'buy-the-way',
      iss: 'https://accounts.google.com',
    });
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user.uid;
  },

  async signOut(): Promise<void> {
    await fbSignOut(auth);
  },

  currentUid(): string | null {
    return auth.currentUser?.uid ?? null;
  },
};
