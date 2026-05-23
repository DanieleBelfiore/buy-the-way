import type { Context } from '@netlify/functions';
import admin from 'firebase-admin';

const initAdmin = (): void => {
  if (admin.apps.length > 0) return;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
};

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse(401, { error: 'missing_token' });

  try {
    initAdmin();
    await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.warn('[find-user] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();

  if (!email) return jsonResponse(400, { error: 'missing_email' });

  try {
    const db = admin.firestore();
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    
    if (snap.empty) {
      return jsonResponse(200, { profile: null });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    
    const profile = {
      uid: data.uid ?? doc.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      lastLoginAt: data.lastLoginAt ?? 0,
      ...(data.lastSeenLists !== undefined && { lastSeenLists: data.lastSeenLists }),
      ...(data.lastSeenListMap !== undefined && { lastSeenListMap: data.lastSeenListMap }),
      ...(data.photoURL && { photoURL: data.photoURL }),
      ...(data.defaultListId !== undefined && { defaultListId: data.defaultListId }),
    };

    return jsonResponse(200, { profile });
  } catch (err) {
    console.error('[find-user] query failed:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
};
