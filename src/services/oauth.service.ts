import { getAuth } from 'firebase/auth';
import type { LocationQuery } from 'vue-router';

/**
 * Client side of the MCP consent screen: forwards the OAuth request to the
 * `oauth-authorize` Netlify function with the user's Firebase ID token. All
 * validation and code issuing happen server-side; this only carries the call.
 */

export type OAuthAction = 'describe' | 'approve' | 'deny';

export type OAuthAuthorizeResult =
  | { status: 'ok'; clientName: string; redirectHost: string }
  | { status: 'redirect'; redirectTo: string }
  | { status: 'unavailable'; redirectTo: string }
  | {
      status: 'invalid';
      reason:
        | 'unknown_client'
        | 'redirect_uri_mismatch'
        | 'unsupported_response_type'
        | 'invalid_request'
        | 'invalid_target';
    };

export class OAuthAuthorizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthAuthorizeError';
  }
}

const OAUTH_PARAM_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'resource',
  'scope',
] as const;

/** The OAuth parameters of the consent URL, nothing else. */
export const pickOAuthParams = (query: LocationQuery): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of OAUTH_PARAM_KEYS) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string') out[key] = value;
  }
  return out;
};

const KNOWN_STATUSES = new Set(['ok', 'redirect', 'unavailable', 'invalid']);

export const callOAuthAuthorize = async (
  action: OAuthAction,
  params: Record<string, string>,
): Promise<OAuthAuthorizeResult> => {
  const user = getAuth().currentUser;
  if (!user) throw new OAuthAuthorizeError('not signed in');

  let res: Response;
  try {
    res = await fetch('/.netlify/functions/oauth-authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ action, params }),
    });
  } catch (err) {
    throw new OAuthAuthorizeError(`transport: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 400 carries a structured `invalid` result; other non-2xx are failures.
  if (!res.ok && res.status !== 400) throw new OAuthAuthorizeError(`HTTP ${res.status}`);
  let body: { status?: unknown };
  try {
    body = (await res.json()) as { status?: unknown };
  } catch {
    throw new OAuthAuthorizeError('malformed response');
  }
  if (typeof body.status !== 'string' || !KNOWN_STATUSES.has(body.status)) {
    throw new OAuthAuthorizeError(`unexpected response (HTTP ${res.status})`);
  }
  return body as OAuthAuthorizeResult;
};

/** Leaves the SPA for the MCP client's redirect URI. Wrapped for tests. */
export const navigateToClient = (url: string): void => {
  window.location.assign(url);
};
