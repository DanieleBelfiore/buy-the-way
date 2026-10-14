import type { Context } from '@netlify/functions';
import { initAdmin } from './_lib/firebase-admin';
import { oauthError, oauthJson, oauthPreflight, parseFormOrJson } from './_lib/oauth';
import { revokeToken } from './_lib/oauth-store';

/**
 * Netlify Function: oauth-revoke (served at /oauth/revoke)
 *
 * RFC 7009 token revocation. Answers 200 for unknown or foreign tokens too,
 * so the endpoint cannot be used to probe which tokens exist. A refresh
 * token revokes its whole grant (see oauth-store). Cost per call is one
 * Firestore read, so it carries no rate limit of its own.
 */
export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('POST');
  if (req.method !== 'POST') return oauthJson(405, { error: 'method_not_allowed' });

  const body = await parseFormOrJson(req);
  const token = body['token'];
  if (!token) return oauthError(400, 'invalid_request', 'token is required');

  try {
    initAdmin();
    await revokeToken(token, body['client_id']);
    return oauthJson(200, {});
  } catch (err) {
    console.error('[oauth-revoke] failed:', err);
    return oauthError(503, 'temporarily_unavailable');
  }
};
