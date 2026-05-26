/**
 * Local-dev bridge for Netlify functions.
 *
 * `pnpm dev` runs vite alone, which does NOT serve `/.netlify/functions/*` -
 * those paths fall through to the SPA fallback (`index.html`) and any
 * `res.json()` on the response explodes with
 *   "Unexpected token '<', \"<!doctype \"... is not valid JSON"
 *
 * This module monkey-patches `window.fetch` to proxy the three call sites of
 * the invite + notifications flow directly against the Firebase emulator,
 * matching the behaviour the production functions implement. Lets a developer
 * iterate on the UI without having to also run `netlify dev`.
 *
 * Loaded only when:
 *   - `import.meta.env.DEV === true`               (vite dev build)
 *   - `VITE_USE_EMULATOR=true`                     (emulator wired up)
 *   - `VITE_E2E !== 'true'`                        (e2e-bridge already owns it)
 *
 * Production builds hard-refuse to even import this module - see the guard
 * below - so the bypass surface can never reach a real Firestore project.
 */
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

if (!import.meta.env.DEV) {
  throw new Error('[dev-bridge] refusing to load outside dev build');
}

const PROJECT_ID = import.meta.env['VITE_FIREBASE_PROJECT_ID'] ?? 'buy-the-way';
const EMULATOR_OWNER_TOKEN = 'owner';
const EMULATOR_FIRESTORE_URL =
  `http://localhost:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const originalFetch = window.fetch;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ----- find-user -----------------------------------------------------------

const handleFindUser = async (urlString: string): Promise<Response> => {
  try {
    const url = new URL(urlString, window.location.origin);
    const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) return jsonResponse(400, { error: 'missing_email' });

    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'email' },
            op: 'EQUAL',
            value: { stringValue: email },
          },
        },
        limit: 1,
      },
    };

    const res = await originalFetch(`${EMULATOR_FIRESTORE_URL}:runQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
      },
      body: JSON.stringify(queryPayload),
    });
    const data = await res.json();
    const found = Array.isArray(data) ? data[0]?.document : null;
    if (!found) return jsonResponse(200, { profile: null });

    const uid = found.name.split('/').pop();
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return jsonResponse(200, { profile: null });

    const raw = snap.data() as Record<string, unknown>;
    const profile: Record<string, unknown> = {
      uid: snap.id,
      email: raw.email ?? '',
      displayName: raw.displayName ?? '',
      lastLoginAt: 0,
    };
    if (raw.photoURL) profile.photoURL = raw.photoURL;
    return jsonResponse(200, { profile });
  } catch (err) {
    console.warn('[dev-bridge] find-user proxy failed:', err);
    return jsonResponse(500, { error: 'dev_bridge_failed' });
  }
};

// ----- send-invite ---------------------------------------------------------

const handleSendInvite = async (init?: RequestInit): Promise<Response> => {
  // Resend isn't reachable from the client in dev; just log the payload so
  // the developer can see the flow and short-circuit with success. The
  // pending-invite Firestore doc the caller already wrote is the real
  // contract - the email is best-effort even in prod.
  try {
    const bodyStr = typeof init?.body === 'string' ? init.body : '';
    const payload = bodyStr ? JSON.parse(bodyStr) : {};
    // eslint-disable-next-line no-console
    console.info('[dev-bridge] send-invite (skipped, would email):', payload);
  } catch {
    /* swallow - dev-only logging */
  }
  return jsonResponse(200, { success: true, dev: true });
};

// ----- send-magic-link -----------------------------------------------------

const handleSendMagicLink = async (init?: RequestInit): Promise<Response> => {
  try {
    const bodyStr = typeof init?.body === 'string' ? init.body : '';
    const payload = bodyStr ? JSON.parse(bodyStr) : {};
    // eslint-disable-next-line no-console
    console.info('[dev-bridge] send-magic-link (skipped, would email):', payload);
  } catch {
    /* swallow - dev-only logging */
  }
  return jsonResponse(200, { ok: true, dev: true });
};

// ----- notify-list-event ---------------------------------------------------

const handleNotifyListEvent = async (init?: RequestInit): Promise<Response> => {
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
    if (!collaborators.includes(caller.uid)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Recipient set: invitee-only for collaborator-added, all-other for item-modified.
    const recipients = payload.kind === 'collaborator-added'
      ? (payload.targetUid && payload.targetUid !== caller.uid
         && collaborators.includes(payload.targetUid)
          ? [payload.targetUid]
          : [])
      : collaborators.filter((u) => u !== caller.uid);
    if (recipients.length === 0) return jsonResponse(200, { ok: true, sent: 0 });

    const now = Date.now();
    const senderName = caller.displayName ?? '';
    const locale = payload.locale === 'en' ? 'en' : 'it';

    // Only item-modified needs an item-name lookup. collaborator-added uses
    // sender + listName slots, both already on hand.
    let subjectName = '';
    if (payload.kind === 'item-modified' && payload.itemId) {
      try {
        const itemSnap = await getDoc(doc(db, 'lists', payload.listId, 'items', payload.itemId));
        if (itemSnap.exists()) {
          subjectName = String((itemSnap.data() as { name?: string }).name ?? '').trim().slice(0, 80);
        }
      } catch {
        /* swallow - dev best-effort */
      }
    }

    const writes = recipients.map((uid) => {
      const docId = `dev-${now}-${Math.random().toString(36).slice(2, 10)}`;
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
          name: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/notifications/${docId}`,
          fields,
        },
      };
    });

    const commitRes = await originalFetch(`${EMULATOR_FIRESTORE_URL}:commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMULATOR_OWNER_TOKEN}`,
      },
      body: JSON.stringify({ writes }),
    });
    if (!commitRes.ok) {
      const text = await commitRes.text();
      console.warn('[dev-bridge] notify commit failed', commitRes.status, text);
    }
    return jsonResponse(200, { ok: true, sent: recipients.length });
  } catch (err) {
    console.warn('[dev-bridge] notify-list-event proxy failed:', err);
    return jsonResponse(500, { error: 'dev_bridge_failed' });
  }
};

// ----- patch ---------------------------------------------------------------

window.fetch = async (input, init) => {
  if (typeof input === 'string') {
    if (input.includes('/.netlify/functions/find-user')) {
      return handleFindUser(input);
    }
    if (input.includes('/.netlify/functions/send-invite')) {
      return handleSendInvite(init);
    }
    if (input.includes('/.netlify/functions/send-magic-link')) {
      return handleSendMagicLink(init);
    }
    if (input.includes('/.netlify/functions/notify-list-event')) {
      return handleNotifyListEvent(init);
    }
  }
  return originalFetch(input, init);
};

// eslint-disable-next-line no-console
console.info('[dev-bridge] netlify functions are proxied to the local emulator');
