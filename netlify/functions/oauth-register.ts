import type { Context } from '@netlify/functions';
import { initAdmin } from './_lib/firebase-admin';
import { createClient } from './_lib/oauth-store';
import { oauthError, oauthJson, oauthPreflight, SUPPORTED_GRANT_TYPES, validateClientRegistration } from './_lib/oauth';
import {
  checkRateLimit,
  rateLimitedResponse,
  rateLimitUnavailableResponse,
  RATE_LIMITS,
} from './_lib/rate-limit';

/**
 * Netlify Function: oauth-register (served at /oauth/register)
 *
 * RFC 7591 Dynamic Client Registration for MCP clients. Public clients only:
 * no secret is issued and `token_endpoint_auth_method` is always `none`,
 * whatever the client asked for. Registration grants nothing by itself: a
 * user still has to approve the client on the consent screen.
 *
 * The only unauthenticated endpoint that writes, so it is capped per IP (high,
 * because claude.ai shares Anthropic's egress IPs) and globally per day, and
 * fails closed when the limiter is down.
 */

const limit = async (key: string, cfg: { funcName: string; max: number; windowMs: number }) =>
  checkRateLimit(key, cfg.funcName, cfg.max, cfg.windowMs);

export default async (req: Request, ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('POST');
  if (req.method !== 'POST') return oauthJson(405, { error: 'method_not_allowed' });

  try {
    initAdmin();
    const byIp = await limit(ctx.ip || 'unknown', RATE_LIMITS.oauthRegisterIp);
    if (!byIp.allowed) return rateLimitedResponse(byIp);
    const global = await limit('global', RATE_LIMITS.oauthRegisterGlobal);
    if (!global.allowed) return rateLimitedResponse(global);
  } catch (err) {
    console.error('[oauth-register] rate-limit check failed (denying):', err);
    return rateLimitUnavailableResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return oauthError(400, 'invalid_client_metadata', 'JSON body expected');
  }
  const parsed = validateClientRegistration(body);
  if (!parsed.ok) return oauthError(400, parsed.error, parsed.description);

  try {
    const client = await createClient(parsed.value);
    return oauthJson(201, {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: [...SUPPORTED_GRANT_TYPES],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  } catch (err) {
    console.error('[oauth-register] store failed:', err);
    return oauthError(500, 'server_error');
  }
};
