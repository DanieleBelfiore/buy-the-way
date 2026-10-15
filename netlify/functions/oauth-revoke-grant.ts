import type { Context } from '@netlify/functions';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from './_lib/firebase-admin';
import { jsonResponse } from './_lib/http';
import { revokeGrantOf } from './_lib/oauth-store';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from './_lib/rate-limit';

/**
 * Netlify Function: oauth-revoke-grant
 *
 * Backend of Settings > Connected apps. The signed-in user disconnects an AI
 * assistant: the grant and every token issued under it are deleted, so the
 * next /mcp call from that client gets 401 and it has to ask for consent
 * again. Grants are readable by their owner but never client-writable
 * (firestore.rules), hence this function.
 *
 * Body: { grantId }. 200 { status: 'revoked' }, or 404 when the grant does
 * not exist or is not the caller's (indistinguishable on purpose). Not gated
 * by the MCP beta switch: revoking must always work.
 */

const MAX_GRANT_ID = 128;

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const header = req.headers.get('authorization') ?? '';
  const idToken = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!idToken) return jsonResponse(401, { error: 'missing_token' });

  let uid: string;
  try {
    initAdmin();
    uid = (await getAuth().verifyIdToken(idToken)).uid;
  } catch (err) {
    console.warn('[oauth-revoke-grant] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  try {
    const { funcName, max, windowMs } = RATE_LIMITS.oauthRevokeGrant;
    const decision = await checkRateLimit(uid, funcName, max, windowMs);
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.warn('[oauth-revoke-grant] rate-limit check failed (allowing):', err);
  }

  let grantId: string;
  try {
    const body = (await req.json()) as { grantId?: unknown };
    if (typeof body.grantId !== 'string' || body.grantId === '' || body.grantId.length > MAX_GRANT_ID) {
      throw new Error('bad body');
    }
    grantId = body.grantId;
  } catch {
    return jsonResponse(400, { error: 'invalid_body' });
  }

  try {
    if (!(await revokeGrantOf(uid, grantId))) return jsonResponse(404, { error: 'not_found' });
    return jsonResponse(200, { status: 'revoked' });
  } catch (err) {
    console.error('[oauth-revoke-grant] failed:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
};
