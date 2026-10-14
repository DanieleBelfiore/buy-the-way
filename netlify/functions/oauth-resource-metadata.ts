import type { Context } from '@netlify/functions';
import { resolveAppUrl } from './_lib/branded-email';
import { canonicalResource, oauthJson, oauthPreflight } from './_lib/oauth';

/**
 * Netlify Function: oauth-resource-metadata
 *
 * RFC 9728 protected resource metadata for the MCP endpoint, served at
 * /.well-known/oauth-protected-resource and its /mcp-suffixed variant
 * (rewrites in netlify.toml). `/mcp` points unauthenticated clients here
 * through its WWW-Authenticate header.
 */
export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('GET');
  if (req.method !== 'GET') return oauthJson(405, { error: 'method_not_allowed' });
  const appUrl = resolveAppUrl();
  return oauthJson(200, {
    resource: canonicalResource(appUrl),
    authorization_servers: [appUrl],
    scopes_supported: ['lists'],
    bearer_methods_supported: ['header'],
    resource_name: 'Buy The Way',
  });
};
