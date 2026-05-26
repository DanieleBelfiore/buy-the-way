/**
 * E2E test bridge - exposes Firebase auth helpers on `window.__btw`
 * so Playwright specs can bypass the Google sign-in popup.
 *
 * Loaded only when `VITE_E2E=true`. Never bundled in production.
 */
import { GoogleAuthProvider, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

// Defense-in-depth: hard-refuse to install the fetch monkey-patch and the
// __btw global if this module is reached in a production build. Production
// must never gain a path to the emulator owner-token or the bypass surface,
// even if VITE_E2E were ever to leak past the build flag.
if (!import.meta.env.DEV) {
  throw new Error('[E2E Bridge] refusing to load outside dev build');
}

// Firebase emulator accepts this literal as a super-user bearer token. Only
// usable against the local emulator - non-emulator Firestore rejects it.
const EMULATOR_OWNER_TOKEN = 'owner';
const EMULATOR_FIRESTORE_URL =
  'http://localhost:8080/v1/projects/buy-the-way/databases/(default)/documents:runQuery';

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
      
      const res = await originalFetch(EMULATOR_FIRESTORE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMULATOR_OWNER_TOKEN}`,
        },
        body: JSON.stringify(queryPayload),
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

      // Mirror the netlify function's minimal payload so E2E exercises the
      // same shape production callers see.
      const raw = snap.data() as Record<string, unknown>;
      const profile: Record<string, unknown> = {
        uid: snap.id,
        email: raw.email ?? '',
        displayName: raw.displayName ?? '',
        lastLoginAt: 0,
      };
      if (raw.photoURL) profile.photoURL = raw.photoURL;
      return new Response(JSON.stringify({ profile }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      console.error('[E2E Bridge] Error finding user:', e);
      return new Response(JSON.stringify({ profile: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (typeof input === 'string' && input.includes('/.netlify/functions/send-invite')) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Mirror the production notify-list-event function: write one notification
  // doc into every recipient's subcollection. We bypass rules with the
  // emulator owner-bearer trick (rules deny client writes; in prod the
  // server uses firebase-admin which also bypasses rules).
  if (typeof input === 'string' && input.includes('/.netlify/functions/notify-list-event')) {
    try {
      const bodyStr = typeof init?.body === 'string' ? init.body : '';
      const payload = JSON.parse(bodyStr) as {
        listId: string;
        kind: 'item-modified' | 'collaborator-added' | 'collaborator-joined';
        itemId?: string;
        targetUid?: string;
        locale?: 'it' | 'en';
      };
      const caller = auth.currentUser;
      if (!caller) return new Response('Unauthorized', { status: 401 });

      const listSnap = await getDoc(doc(db, 'lists', payload.listId));
      if (!listSnap.exists()) return new Response('Not Found', { status: 404 });
      const listData = listSnap.data() as { collaboratorUids?: string[]; name?: string };
      const collaborators = listData.collaboratorUids ?? [];
      if (!collaborators.includes(caller.uid)) return new Response('Forbidden', { status: 403 });

      const recipients = payload.kind === 'collaborator-added'
        ? (payload.targetUid && payload.targetUid !== caller.uid
           && collaborators.includes(payload.targetUid)
            ? [payload.targetUid]
            : [])
        : collaborators.filter((u) => u !== caller.uid);
      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = Date.now();
      const senderName = caller.displayName ?? '';
      const locale = payload.locale === 'en' ? 'en' : 'it';

      let subjectName = '';
      if (payload.kind === 'item-modified' && payload.itemId) {
        try {
          const itemSnap = await getDoc(doc(db, 'lists', payload.listId, 'items', payload.itemId));
          if (itemSnap.exists()) {
            subjectName = String((itemSnap.data() as { name?: string }).name ?? '').trim().slice(0, 80);
          }
        } catch {
          /* swallow - e2e best-effort */
        }
      }

      const writes = recipients.map((uid) => {
        const docId = `e2e-${now}-${Math.random().toString(36).slice(2, 10)}`;
        const fields: Record<string, unknown> = {
          kind: { stringValue: payload.kind },
          listId: { stringValue: payload.listId },
          listName: { stringValue: listData.name ?? '' },
          senderUid: { stringValue: caller.uid },
          senderName: { stringValue: senderName },
          locale: { stringValue: locale },
          createdAt: { integerValue: String(now) },
        };
        if (payload.itemId) fields.itemId = { stringValue: payload.itemId };
        if (subjectName) fields.itemName = { stringValue: subjectName };
        return {
          update: {
            name: `projects/buy-the-way/databases/(default)/documents/users/${uid}/notifications/${docId}`,
            fields,
          },
        };
      });

      const commitRes = await originalFetch(
        'http://localhost:8080/v1/projects/buy-the-way/databases/(default)/documents:commit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMULATOR_OWNER_TOKEN}`,
          },
          body: JSON.stringify({ writes }),
        },
      );
      if (!commitRes.ok) {
        const text = await commitRes.text();
        console.warn('[E2E Bridge] notify commit failed', commitRes.status, text);
      }

      return new Response(JSON.stringify({ ok: true, sent: recipients.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('[E2E Bridge] notify-list-event mock failed:', e);
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    }
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
