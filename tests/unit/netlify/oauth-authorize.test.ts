import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { verifyIdToken, getClient, createAuthCode, isMcpAllowed, checkRateLimit } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getClient: vi.fn(),
  createAuthCode: vi.fn(),
  isMcpAllowed: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/../netlify/functions/_lib/firebase-admin', () => ({ initAdmin: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('@/../netlify/functions/_lib/oauth-store', () => ({ getClient, createAuthCode }));
vi.mock('@/../netlify/functions/_lib/mcp-gate', () => ({ isMcpAllowed }));
vi.mock('@/../netlify/functions/_lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/../netlify/functions/_lib/rate-limit')>()),
  checkRateLimit,
}));

import handler from '@/../netlify/functions/oauth-authorize';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const baseParams = {
  response_type: 'code',
  client_id: 'mcp_abc',
  redirect_uri: REDIRECT,
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  state: 'st-1',
  resource: 'https://app.example/mcp',
};

const call = (action: string, params: Record<string, string | undefined> = baseParams, token: string | null = 'id-token') =>
  handler(
    new Request('http://localhost/.netlify/functions/oauth-authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, params }),
    }),
    {} as any,
  );

const redirectOf = async (res: Response): Promise<URL> => {
  const body = (await res.json()) as { status: string; redirectTo: string };
  expect(body.status).toBe('redirect');
  return new URL(body.redirectTo);
};

describe('oauth-authorize function (consent screen backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['APP_URL'] = 'https://app.example';
    verifyIdToken.mockResolvedValue({ uid: 'me' });
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    getClient.mockResolvedValue({ clientId: 'mcp_abc', redirectUris: [REDIRECT], clientName: 'Claude', createdAt: 1 });
    isMcpAllowed.mockResolvedValue(true);
    createAuthCode.mockResolvedValue('the-code');
  });
  afterEach(() => {
    delete process.env['APP_URL'];
  });

  describe('transport', () => {
    it('requires POST', async () => {
      const res = await handler(new Request('http://localhost/x'), {} as any);
      expect(res.status).toBe(405);
    });

    it('requires a valid Firebase ID token', async () => {
      expect((await call('describe', baseParams, null)).status).toBe(401);
      verifyIdToken.mockRejectedValueOnce(new Error('expired'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect((await call('describe')).status).toBe(401);
    });

    it('rate limits per uid', async () => {
      checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterMs: 1000 });
      const res = await call('describe');
      expect(res.status).toBe(429);
      expect(checkRateLimit).toHaveBeenCalledWith('me', 'oauth-authorize', 30, 600_000);
    });

    it('rejects an unknown action', async () => {
      expect((await call('steal')).status).toBe(400);
    });
  });

  describe('errors shown on the page, never redirected (open-redirect guard)', () => {
    it('unknown client', async () => {
      getClient.mockResolvedValueOnce(null);
      const res = await call('describe');
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: 'invalid', reason: 'unknown_client' });
    });

    it('redirect_uri not registered', async () => {
      const res = await call('approve', { ...baseParams, redirect_uri: 'https://evil.example/cb' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ status: 'invalid', reason: 'redirect_uri_mismatch' });
      expect(createAuthCode).not.toHaveBeenCalled();
    });

    it('missing redirect_uri with several registered', async () => {
      getClient.mockResolvedValueOnce({ clientId: 'mcp_abc', redirectUris: [REDIRECT, 'https://b.example/cb'], clientName: 'X', createdAt: 1 });
      const res = await call('describe', { ...baseParams, redirect_uri: undefined });
      expect(await res.json()).toEqual({ status: 'invalid', reason: 'redirect_uri_mismatch' });
    });
  });

  describe('request errors are shown on the page, not redirected (RFC 9700 4.11.2)', () => {
    // With open client registration anyone can register any https redirect
    // URI, so an automatic error redirect would turn the app domain into an
    // open redirector. Only an explicit user decision leads off-site.
    it.each([
      [{ response_type: 'token' }, 'unsupported_response_type'],
      [{ code_challenge: undefined }, 'invalid_request'],
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ code_challenge_method: undefined }, 'invalid_request'],
      [{ code_challenge: 'short' }, 'invalid_request'],
      [{ resource: 'https://other.example/mcp' }, 'invalid_target'],
    ])('%j -> invalid %s, for describe and approve alike', async (override, reason) => {
      for (const action of ['describe', 'approve', 'deny']) {
        const res = await call(action, { ...baseParams, ...override });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ status: 'invalid', reason });
      }
      expect(createAuthCode).not.toHaveBeenCalled();
    });
  });

  describe('happy paths', () => {
    it('describe returns what the consent screen shows', async () => {
      const res = await call('describe');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok', clientName: 'Claude', redirectHost: 'claude.ai' });
      expect(createAuthCode).not.toHaveBeenCalled();
    });

    it('approve issues a code bound to uid, client, redirect, challenge and resource', async () => {
      const url = await redirectOf(await call('approve'));
      expect(url.searchParams.get('code')).toBe('the-code');
      expect(url.searchParams.get('state')).toBe('st-1');
      expect(url.searchParams.get('iss')).toBe('https://app.example');
      expect(createAuthCode).toHaveBeenCalledWith({
        uid: 'me',
        clientId: 'mcp_abc',
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
        resource: 'https://app.example/mcp',
      });
    });

    it('defaults redirect_uri to the single registered one and resource to /mcp', async () => {
      await call('approve', { ...baseParams, redirect_uri: undefined, resource: undefined });
      expect(createAuthCode).toHaveBeenCalledWith(expect.objectContaining({
        redirectUri: REDIRECT,
        resource: 'https://app.example/mcp',
      }));
    });

    it('deny redirects with access_denied', async () => {
      const url = await redirectOf(await call('deny'));
      expect(url.searchParams.get('error')).toBe('access_denied');
      expect(url.searchParams.has('code')).toBe(false);
    });
  });

  describe('private beta gate', () => {
    beforeEach(() => {
      isMcpAllowed.mockResolvedValue(false);
    });

    it('describe reports unavailable with an access_denied exit', async () => {
      const res = await call('describe');
      const body = (await res.json()) as { status: string; redirectTo: string };
      expect(body.status).toBe('unavailable');
      expect(new URL(body.redirectTo).searchParams.get('error')).toBe('access_denied');
      expect(isMcpAllowed).toHaveBeenCalledWith('me');
    });

    it('approve never issues a code', async () => {
      const res = await call('approve');
      expect((await res.json()).status).toBe('unavailable');
      expect(createAuthCode).not.toHaveBeenCalled();
    });
  });

  it('returns 500 when the store fails', async () => {
    createAuthCode.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call('approve')).status).toBe(500);
  });
});
