import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { sanitizeFreeText } from './sanitize';

/**
 * Pure OAuth 2.1 helpers for the MCP authorization server (no Firestore, no
 * network). The endpoints in netlify/functions/oauth-*.ts compose these with
 * the store in ./oauth-store.ts. Design notes: tasks/mcp-plan.md.
 */

export const OAUTH_TTL = {
  /** Authorization code: single use, exchanged right after the redirect. */
  codeMs: 60_000,
  accessMs: 60 * 60 * 1000,
  /** Sliding: every refresh issues a new refresh token with a fresh TTL. */
  refreshMs: 30 * 24 * 60 * 60 * 1000,
  /**
   * A rotated refresh token presented again within this window is refused
   * without revoking the grant: a client retrying a refresh whose answer was
   * lost, or two parallel requests refreshing at once, is not a theft.
   */
  refreshReuseGraceMs: 30_000,
} as const;

/** Only grant types the server implements. Public clients, PKCE mandatory. */
export const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;

const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 2000;
const MAX_CLIENT_NAME_LENGTH = 80;
const DEFAULT_CLIENT_NAME = 'MCP client';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 256-bit opaque token, base64url (43 chars). Never stored in clear. */
export const generateToken = (): string => base64url(randomBytes(32));

/** Storage key for a token / code: only the hash ever reaches Firestore. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const PKCE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;

/** RFC 7636 S256: base64url(sha256(verifier)) == challenge, constant time. */
export const verifyPkceS256 = (verifier: string, challenge: string): boolean => {
  if (!PKCE_VERIFIER.test(verifier)) return false;
  const expected = Buffer.from(base64url(createHash('sha256').update(verifier).digest()));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const isLoopback = (url: URL): boolean => url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);

/**
 * Redirect URIs a client may register: any https URI, or plain http on a
 * loopback host (native / CLI clients such as Claude Code). No fragments, no
 * embedded credentials.
 */
export const isAllowedRedirectUri = (raw: string): boolean => {
  if (raw.length > MAX_REDIRECT_URI_LENGTH) return false;
  const url = parseUrl(raw);
  if (!url || url.hash || url.username || url.password) return false;
  return url.protocol === 'https:' || isLoopback(url);
};

/**
 * Exact match against the registered URIs, except that loopback URIs match on
 * any port: native clients bind an ephemeral port per run (RFC 8252 7.3).
 */
export const redirectUriMatches = (registered: readonly string[], candidate: string): boolean => {
  const url = parseUrl(candidate);
  if (!url) return false;
  return registered.some((reg) => {
    if (reg === candidate) return true;
    const r = parseUrl(reg);
    if (!r || !isLoopback(r) || !isLoopback(url)) return false;
    return r.hostname === url.hostname && r.pathname === url.pathname && r.search === url.search;
  });
};

export interface ClientRegistration {
  redirectUris: string[];
  clientName: string;
}

export type RegistrationResult =
  | { ok: true; value: ClientRegistration }
  | { ok: false; error: 'invalid_redirect_uri' | 'invalid_client_metadata'; description: string };

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * RFC 7591 request validation. Everything the server does not implement is
 * refused rather than silently ignored, except `token_endpoint_auth_method`:
 * the response always says `none` and clients adapt to it.
 */
export const validateClientRegistration = (body: unknown): RegistrationResult => {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_client_metadata', description: 'JSON object expected' };
  }
  const b = body as Record<string, unknown>;
  const uris = b['redirect_uris'];
  if (
    !isStringArray(uris)
    || uris.length === 0
    || uris.length > MAX_REDIRECT_URIS
    || !uris.every(isAllowedRedirectUri)
  ) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description: 'redirect_uris must be 1-10 https or loopback http URIs',
    };
  }
  const grantTypes = b['grant_types'];
  if (
    grantTypes !== undefined
    && (!isStringArray(grantTypes)
      || !grantTypes.every((g) => (SUPPORTED_GRANT_TYPES as readonly string[]).includes(g)))
  ) {
    return { ok: false, error: 'invalid_client_metadata', description: 'unsupported grant_types' };
  }
  const responseTypes = b['response_types'];
  if (responseTypes !== undefined && (!isStringArray(responseTypes) || !responseTypes.every((r) => r === 'code'))) {
    return { ok: false, error: 'invalid_client_metadata', description: 'only response_type code is supported' };
  }
  const rawName = typeof b['client_name'] === 'string' ? b['client_name'] : '';
  const clientName = sanitizeFreeText(rawName, MAX_CLIENT_NAME_LENGTH) || DEFAULT_CLIENT_NAME;
  return { ok: true, value: { redirectUris: [...uris], clientName } };
};

/** RFC 8707 resource indicator the tokens are bound to. */
export const canonicalResource = (appUrl: string): string => `${appUrl.replace(/\/+$/, '')}/mcp`;

/**
 * Clients should send `resource`; a missing one binds to the MCP server, the
 * only resource this authorization server protects. Anything else is refused.
 */
export const isValidResource = (resource: string | undefined, appUrl: string): boolean =>
  resource === undefined || resource.replace(/\/+$/, '') === canonicalResource(appUrl);

/** Append OAuth response params to a client redirect URI. */
export const buildRedirect = (redirectUri: string, params: Record<string, string | undefined>): string => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
};

/**
 * Token and revocation endpoints must accept form bodies (RFC 6749); some MCP
 * clients send JSON. Non-string values are dropped, a malformed body yields {}.
 */
export const parseFormOrJson = async (req: Request): Promise<Record<string, string>> => {
  const type = req.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(body ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'),
      );
    }
    return Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return {};
  }
};

const CORS_HEADERS = {
  // Browser-based MCP clients (e.g. MCP Inspector) call these endpoints
  // cross-origin. Nothing here relies on cookies, so `*` without credentials
  // is safe.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
} as const;

/** JSON response for OAuth / MCP endpoints: no caching (RFC 6749 5.1), CORS. */
export const oauthJson = (
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
      ...headers,
    },
  });

/** RFC 6749 5.2 error body. */
export const oauthError = (status: number, error: string, description?: string): Response =>
  oauthJson(status, description ? { error, error_description: description } : { error });

export const oauthPreflight = (methods: string): Response =>
  new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': `${methods}, OPTIONS`,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    },
  });
