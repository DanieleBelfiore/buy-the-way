import type { Context } from '@netlify/functions';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { initAdmin } from '../functions/_lib/firebase-admin';
import { resolveAppUrl } from '../functions/_lib/branded-email';
import { oauthJson, oauthPreflight } from '../functions/_lib/oauth';
import { resolveAccessToken } from '../functions/_lib/oauth-store';
import { isMcpAllowed } from '../functions/_lib/mcp-gate';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from '../functions/_lib/rate-limit';
import { buildMcpServer } from './server';
import { ensureSignedIn, serialized } from './session';

/**
 * The /mcp endpoint (MCP Streamable HTTP, stateless, JSON responses).
 * Built by `pnpm build:mcp` into netlify/functions/mcp.mjs, with
 * `@/services/firebase` swapped for the Node module (vite.mcp.config.ts).
 *
 *   bearer token -> oauth-store (uid) -> beta gate -> per-uid rate limits
 *   -> client SDK signed in as uid -> fresh McpServer -> JSON-RPC
 *
 * No session state: every request builds its own server and transport. GET
 * would open an SSE stream, which a function cannot keep open, so only POST
 * is served (the spec allows 405 there).
 */

const withCors = (res: Response): Response => {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

const unauthorized = (appUrl: string, error?: 'invalid_token'): Response => {
  const metadata = `resource_metadata="${appUrl}/.well-known/oauth-protected-resource/mcp"`;
  return oauthJson(
    401,
    { error: error ?? 'unauthorized' },
    { 'WWW-Authenticate': error ? `Bearer ${metadata}, error="${error}"` : `Bearer ${metadata}` },
  );
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === 'OPTIONS') return oauthPreflight('POST');
  if (req.method !== 'POST') return oauthJson(405, { error: 'method_not_allowed' }, { Allow: 'POST, OPTIONS' });

  const appUrl = resolveAppUrl();
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return unauthorized(appUrl);

  let uid: string;
  try {
    initAdmin();
    const info = await resolveAccessToken(token);
    if (!info) return unauthorized(appUrl, 'invalid_token');
    uid = info.uid;
  } catch (err) {
    console.error('[mcp] token resolution failed:', err);
    return oauthJson(500, { error: 'server_error' });
  }

  if (!(await isMcpAllowed(uid))) {
    return oauthJson(403, {
      error: 'access_denied',
      error_description: 'Access through AI assistants is not available for this account yet.',
    });
  }

  try {
    for (const cfg of [RATE_LIMITS.mcp, RATE_LIMITS.mcpDaily]) {
      const decision = await checkRateLimit(uid, cfg.funcName, cfg.max, cfg.windowMs);
      if (!decision.allowed) return rateLimitedResponse(decision);
    }
  } catch (err) {
    console.warn('[mcp] rate-limit check failed (allowing):', err);
  }

  try {
    return await serialized(async () => {
      await ensureSignedIn(uid);
      const server = buildMcpServer(uid);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      return withCors(await transport.handleRequest(req));
    });
  } catch (err) {
    console.error('[mcp] request failed:', err);
    return oauthJson(500, { error: 'server_error' });
  }
};
