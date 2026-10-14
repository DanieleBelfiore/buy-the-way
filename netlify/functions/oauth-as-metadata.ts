import type { Context } from '@netlify/functions';
import { resolveAppUrl } from './_lib/branded-email';
import { oauthJson, oauthPreflight, SUPPORTED_GRANT_TYPES } from './_lib/oauth';

/**
 * Netlify Function: oauth-as-metadata
 *
 * RFC 8414 authorization server metadata, served at
 * /.well-known/oauth-authorization-server (rewrite in netlify.toml). MCP
 * clients read it after following the protected resource metadata.
 */
export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('GET');
  if (req.method !== 'GET') return oauthJson(405, { error: 'method_not_allowed' });
  const issuer = resolveAppUrl();
  return oauthJson(200, {
    issuer,
    // SPA route (consent screen), not a function.
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: [...SUPPORTED_GRANT_TYPES],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['lists'],
  });
};
