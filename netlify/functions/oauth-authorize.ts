import type { Context } from '@netlify/functions';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from './_lib/firebase-admin';
import { jsonResponse } from './_lib/http';
import { resolveAppUrl } from './_lib/branded-email';
import { buildRedirect, canonicalResource, isValidResource, redirectUriMatches } from './_lib/oauth';
import { createAuthCode, getClient } from './_lib/oauth-store';
import { isMcpAllowed } from './_lib/mcp-gate';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from './_lib/rate-limit';

/**
 * Netlify Function: oauth-authorize
 *
 * Backend of the consent screen (SPA route /oauth/authorize, which is the
 * `authorization_endpoint`). The SPA forwards the OAuth query string plus the
 * signed-in user's Firebase ID token:
 *
 *   describe -> what to show (client name, redirect host), or the error
 *   approve  -> issues a code, returns the client redirect
 *   deny     -> returns the client redirect with error=access_denied
 *
 * Request errors are reported on the page and never redirected, including
 * the ones RFC 6749 4.1.2.1 would send back to the client: with open dynamic
 * registration anyone can register any https redirect URI, so an automatic
 * error redirect would make the app domain an open redirector (RFC 9700
 * 4.11.2). The only ways off-site are explicit user clicks: Allow (code),
 * Deny (access_denied) and, in the private beta, "Back" (access_denied).
 */

type Action = 'describe' | 'approve' | 'deny';
const ACTIONS: readonly Action[] = ['describe', 'approve', 'deny'];
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

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
    console.warn('[oauth-authorize] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  try {
    const { funcName, max, windowMs } = RATE_LIMITS.oauthAuthorize;
    const decision = await checkRateLimit(uid, funcName, max, windowMs);
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.warn('[oauth-authorize] rate-limit check failed (allowing):', err);
  }

  let action: Action;
  let p: Record<string, unknown>;
  try {
    const body = (await req.json()) as { action?: unknown; params?: unknown };
    if (!ACTIONS.includes(body.action as Action) || !body.params || typeof body.params !== 'object') {
      throw new Error('bad body');
    }
    action = body.action as Action;
    p = body.params as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { error: 'invalid_body' });
  }

  try {
    const client = await getClient(str(p['client_id']) ?? '');
    if (!client) return jsonResponse(400, { status: 'invalid', reason: 'unknown_client' });

    const requested = str(p['redirect_uri']);
    const redirectUri = requested ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
    if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
      return jsonResponse(400, { status: 'invalid', reason: 'redirect_uri_mismatch' });
    }

    const invalid = (reason: string) => jsonResponse(400, { status: 'invalid', reason });
    if (p['response_type'] !== 'code') return invalid('unsupported_response_type');
    const challenge = str(p['code_challenge']);
    if (!challenge || !S256_CHALLENGE.test(challenge) || p['code_challenge_method'] !== 'S256') {
      return invalid('invalid_request');
    }
    const appUrl = resolveAppUrl();
    const resource = str(p['resource']);
    if (!isValidResource(resource, appUrl)) return invalid('invalid_target');

    // Valid request: only reached through a user decision from here on.
    const state = str(p['state']);
    const back = (params: Record<string, string>) =>
      buildRedirect(redirectUri, { ...params, state, iss: appUrl });
    const redirect = (params: Record<string, string>) =>
      jsonResponse(200, { status: 'redirect', redirectTo: back(params) });

    if (!(await isMcpAllowed(uid))) {
      return jsonResponse(200, { status: 'unavailable', redirectTo: back({ error: 'access_denied' }) });
    }

    if (action === 'describe') {
      return jsonResponse(200, {
        status: 'ok',
        clientName: client.clientName,
        redirectHost: new URL(redirectUri).host,
      });
    }
    if (action === 'deny') return redirect({ error: 'access_denied' });

    const code = await createAuthCode({
      uid,
      clientId: client.clientId,
      redirectUri,
      codeChallenge: challenge,
      resource: canonicalResource(appUrl),
    });
    return redirect({ code });
  } catch (err) {
    console.error('[oauth-authorize] failed:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
};
