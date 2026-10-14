import type { Context } from '@netlify/functions';
import { initAdmin } from './_lib/firebase-admin';
import { resolveAppUrl } from './_lib/branded-email';
import {
  isValidResource,
  oauthError,
  oauthJson,
  oauthPreflight,
  parseFormOrJson,
  verifyPkceS256,
} from './_lib/oauth';
import { consumeAuthCode, getClient, issueTokens, rotateRefreshToken, type IssuedTokens } from './_lib/oauth-store';
import { isMcpAllowed } from './_lib/mcp-gate';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from './_lib/rate-limit';

/**
 * Netlify Function: oauth-token (served at /oauth/token)
 *
 * OAuth 2.1 token endpoint for public MCP clients:
 *   authorization_code: single-use code + PKCE S256 + same redirect_uri
 *   refresh_token:      rotation with reuse detection (see oauth-store)
 *
 * Rate limited per client_id, never per IP: claude.ai calls from Anthropic's
 * shared egress IPs. The beta gate is enforced on code exchange; refreshed
 * tokens are still refused by /mcp, which re-checks the gate per request.
 */

const tokenResponse = (t: IssuedTokens): Response =>
  oauthJson(200, {
    access_token: t.accessToken,
    token_type: 'Bearer',
    expires_in: t.expiresIn,
    refresh_token: t.refreshToken,
    scope: 'lists',
  });

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('POST');
  if (req.method !== 'POST') return oauthJson(405, { error: 'method_not_allowed' });

  const body = await parseFormOrJson(req);
  const clientId = body['client_id'] ?? '';

  try {
    initAdmin();
    const client = await getClient(clientId);
    if (!client) return oauthError(401, 'invalid_client');

    try {
      const { funcName, max, windowMs } = RATE_LIMITS.oauthToken;
      const decision = await checkRateLimit(client.clientId, funcName, max, windowMs);
      if (!decision.allowed) return rateLimitedResponse(decision);
    } catch (err) {
      console.warn('[oauth-token] rate-limit check failed (allowing):', err);
    }

    if (body['grant_type'] === 'authorization_code') {
      const code = body['code'];
      const verifier = body['code_verifier'];
      const redirectUri = body['redirect_uri'];
      if (!code || !verifier || !redirectUri) {
        return oauthError(400, 'invalid_request', 'code, code_verifier and redirect_uri are required');
      }
      if (!isValidResource(body['resource'], resolveAppUrl())) return oauthError(400, 'invalid_target');

      // Consumed before the checks below: a wrong verifier still burns the code.
      const grant = await consumeAuthCode(code);
      if (
        !grant
        || grant.clientId !== client.clientId
        || grant.redirectUri !== redirectUri
        || !verifyPkceS256(verifier, grant.codeChallenge)
      ) {
        return oauthError(400, 'invalid_grant');
      }
      if (!(await isMcpAllowed(grant.uid))) {
        return oauthError(400, 'invalid_grant', 'access is not available for this account');
      }
      const tokens = await issueTokens({
        uid: grant.uid,
        clientId: client.clientId,
        clientName: client.clientName,
        resource: grant.resource,
      });
      return tokenResponse(tokens);
    }

    if (body['grant_type'] === 'refresh_token') {
      const refreshToken = body['refresh_token'];
      if (!refreshToken) return oauthError(400, 'invalid_request', 'refresh_token is required');
      const rotated = await rotateRefreshToken(refreshToken, client.clientId);
      if (!rotated.ok) return oauthError(400, 'invalid_grant');
      return tokenResponse(rotated.tokens);
    }

    return oauthError(400, 'unsupported_grant_type');
  } catch (err) {
    console.error('[oauth-token] failed:', err);
    return oauthError(500, 'server_error');
  }
};
