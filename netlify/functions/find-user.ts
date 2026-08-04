import type { Context } from '@netlify/functions';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  checkRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from './_lib/rate-limit';
import { initAdmin } from './_lib/firebase-admin';
import { jsonResponse } from './_lib/http';

/**
 * Netlify Function: find-user
 *
 * Email lookup for the collaborator invite UI. Returns only the public profile
 * fields needed to add an existing user to a list.
 */

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'GET') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse(401, { error: 'missing_token' });

  let callerUid: string;
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    callerUid = decoded.uid;
  } catch (err) {
    console.warn('[find-user] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  try {
    const decision = await checkRateLimit(
      callerUid,
      RATE_LIMITS.findUser.funcName,
      RATE_LIMITS.findUser.max,
      RATE_LIMITS.findUser.windowMs,
    );
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.warn('[find-user] rate-limit check failed (allowing):', err);
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();

  if (!email) return jsonResponse(400, { error: 'missing_email' });

  try {
    const db = getFirestore();
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();

    if (snap.empty) {
      return jsonResponse(200, { profile: null });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    const profile: Record<string, unknown> = {
      uid: data.uid ?? doc.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      lastLoginAt: 0,
    };
    if (data.photoURL) profile.photoURL = data.photoURL;

    return jsonResponse(200, { profile });
  } catch (err) {
    console.error('[find-user] query failed:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
};
