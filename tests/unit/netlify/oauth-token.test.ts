import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getClient, consumeAuthCode, issueTokens, rotateRefreshToken, isMcpAllowed, checkRateLimit } = vi.hoisted(() => ({
  getClient: vi.fn(),
  consumeAuthCode: vi.fn(),
  issueTokens: vi.fn(),
  rotateRefreshToken: vi.fn(),
  isMcpAllowed: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/../netlify/functions/_lib/firebase-admin', () => ({ initAdmin: vi.fn() }));
vi.mock('@/../netlify/functions/_lib/oauth-store', () => ({ getClient, consumeAuthCode, issueTokens, rotateRefreshToken }));
vi.mock('@/../netlify/functions/_lib/mcp-gate', () => ({ isMcpAllowed }));
vi.mock('@/../netlify/functions/_lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/../netlify/functions/_lib/rate-limit')>()),
  checkRateLimit,
}));

import handler from '@/../netlify/functions/oauth-token';

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const RESOURCE = 'https://app.example/mcp';

const form = (fields: Record<string, string | undefined>) =>
  handler(
    new Request('http://localhost/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        Object.entries(fields).filter((e): e is [string, string] => e[1] !== undefined),
      ).toString(),
    }),
    {} as any,
  );

const codeGrant = (over: Record<string, string | undefined> = {}) =>
  form({
    grant_type: 'authorization_code',
    client_id: 'mcp_abc',
    code: 'the-code',
    code_verifier: VERIFIER,
    redirect_uri: REDIRECT,
    resource: RESOURCE,
    ...over,
  });

const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

describe('oauth-token function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['APP_URL'] = 'https://app.example';
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    getClient.mockResolvedValue({ clientId: 'mcp_abc', redirectUris: [REDIRECT], clientName: 'Claude', createdAt: 1 });
    consumeAuthCode.mockResolvedValue({
      uid: 'me', clientId: 'mcp_abc', redirectUri: REDIRECT, codeChallenge: CHALLENGE, resource: RESOURCE, expiresAtMs: 0,
    });
    isMcpAllowed.mockResolvedValue(true);
    issueTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 });
    rotateRefreshToken.mockResolvedValue({ ok: true, uid: 'me', tokens: { accessToken: 'at2', refreshToken: 'rt2', expiresIn: 3600 } });
  });

  it('answers preflight and refuses non-POST', async () => {
    expect((await handler(new Request('http://localhost/oauth/token', { method: 'OPTIONS' }), {} as any)).status).toBe(204);
    expect((await handler(new Request('http://localhost/oauth/token'), {} as any)).status).toBe(405);
  });

  it('rejects an unknown client with invalid_client (401)', async () => {
    getClient.mockResolvedValueOnce(null);
    const res = await codeGrant();
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toBe('invalid_client');
  });

  it('rate limits per client_id, never per IP', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterMs: 1000 });
    expect((await codeGrant()).status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('mcp_abc', 'oauth-token', 60, 3_600_000);
  });

  it('rejects an unsupported grant type', async () => {
    const res = await form({ grant_type: 'password', client_id: 'mcp_abc' });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe('unsupported_grant_type');
  });

  describe('authorization_code', () => {
    it('exchanges a valid code for a token pair', async () => {
      const res = await codeGrant();
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(await res.json()).toEqual({
        access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt', scope: 'lists',
      });
      expect(consumeAuthCode).toHaveBeenCalledWith('the-code');
      expect(issueTokens).toHaveBeenCalledWith({ uid: 'me', clientId: 'mcp_abc', clientName: 'Claude', resource: RESOURCE });
    });

    it('accepts a JSON body too', async () => {
      const res = await handler(
        new Request('http://localhost/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'authorization_code', client_id: 'mcp_abc', code: 'the-code', code_verifier: VERIFIER, redirect_uri: REDIRECT }),
        }),
        {} as any,
      );
      expect(res.status).toBe(200);
    });

    it.each([
      ['missing code', { code: undefined }],
      ['missing verifier', { code_verifier: undefined }],
      ['wrong verifier', { code_verifier: `${VERIFIER.slice(0, -1)}A` }],
      ['different redirect_uri', { redirect_uri: 'https://claude.ai/other' }],
      ['wrong resource', { resource: 'https://other.example/mcp' }],
    ])('%s -> invalid_grant, no tokens', async (_label, over) => {
      const res = await codeGrant(over);
      expect(res.status).toBe(400);
      expect(['invalid_grant', 'invalid_request', 'invalid_target']).toContain(await errorOf(res));
      expect(issueTokens).not.toHaveBeenCalled();
    });

    it('rejects a used, expired or unknown code', async () => {
      consumeAuthCode.mockResolvedValueOnce(null);
      const res = await codeGrant();
      expect(await errorOf(res)).toBe('invalid_grant');
      expect(issueTokens).not.toHaveBeenCalled();
    });

    it('rejects a code issued to another client', async () => {
      consumeAuthCode.mockResolvedValueOnce({
        uid: 'me', clientId: 'mcp_other', redirectUri: REDIRECT, codeChallenge: CHALLENGE, resource: RESOURCE, expiresAtMs: 0,
      });
      expect(await errorOf(await codeGrant())).toBe('invalid_grant');
      expect(issueTokens).not.toHaveBeenCalled();
    });

    it('refuses to issue tokens when the beta gate closed meanwhile', async () => {
      isMcpAllowed.mockResolvedValueOnce(false);
      expect(await errorOf(await codeGrant())).toBe('invalid_grant');
      expect(issueTokens).not.toHaveBeenCalled();
    });
  });

  describe('refresh_token', () => {
    it('rotates the refresh token', async () => {
      const res = await form({ grant_type: 'refresh_token', client_id: 'mcp_abc', refresh_token: 'rt' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        access_token: 'at2', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt2', scope: 'lists',
      });
      expect(rotateRefreshToken).toHaveBeenCalledWith('rt', 'mcp_abc');
    });

    it.each(['invalid', 'reused'])('maps a %s refresh token to invalid_grant', async (reason) => {
      rotateRefreshToken.mockResolvedValueOnce({ ok: false, reason });
      const res = await form({ grant_type: 'refresh_token', client_id: 'mcp_abc', refresh_token: 'rt' });
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toBe('invalid_grant');
    });

    it('requires the refresh_token parameter', async () => {
      const res = await form({ grant_type: 'refresh_token', client_id: 'mcp_abc' });
      expect(await errorOf(res)).toBe('invalid_request');
      expect(rotateRefreshToken).not.toHaveBeenCalled();
    });
  });

  it('returns server_error when the store throws', async () => {
    issueTokens.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await codeGrant();
    expect(res.status).toBe(500);
    expect(await errorOf(res)).toBe('server_error');
  });
});
