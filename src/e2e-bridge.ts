/**
 * E2E test bridge — exposes Firebase auth helpers on `window.__btw`
 * so Playwright specs can bypass the Google sign-in popup.
 *
 * Loaded only when `VITE_E2E=true`. Never bundled in production.
 */
import { GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (typeof input === 'string' && input.includes('/.netlify/functions/find-user')) {
    const url = new URL(input, window.location.origin);
    const email = url.searchParams.get('email');
    if (!email) return new Response('Bad Request', { status: 400 });

    try {
      const queryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: email }
            }
          }
        }
      };
      
      const res = await originalFetch('http://localhost:8080/v1/projects/buy-the-way/databases/(default)/documents:runQuery', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer owner' 
        },
        body: JSON.stringify(queryPayload)
      });
      
      const data = await res.json();
      const docData = data[0]?.document;
      
      if (!docData) {
        return new Response(JSON.stringify({ profile: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const uid = docData.name.split('/').pop();
      const snap = await getDoc(doc(db, 'users', uid));
      
      if (!snap.exists()) {
        return new Response(JSON.stringify({ profile: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      const profile = snap.data();
      return new Response(JSON.stringify({ profile: { uid: snap.id, ...profile } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('[E2E Bridge] Error finding user:', e);
      return new Response(JSON.stringify({ profile: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (typeof input === 'string' && input.includes('/.netlify/functions/send-invite')) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return originalFetch(input, init);
};

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
