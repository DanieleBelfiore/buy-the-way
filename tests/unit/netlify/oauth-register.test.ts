import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClient, checkRateLimit } = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/../netlify/functions/_lib/firebase-admin', () => ({ initAdmin: vi.fn() }));
vi.mock('@/../netlify/functions/_lib/oauth-store', () => ({ createClient }));
vi.mock('@/../netlify/functions/_lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/../netlify/functions/_lib/rate-limit')>()),
  checkRateLimit,
}));

import handler from '@/../netlify/functions/oauth-register';
import { initAdmin } from '@/../netlify/functions/_lib/firebase-admin';

const post = (body: unknown, ip = '203.0.113.7') =>
  handler(
    new Request('http://localhost/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { ip } as any,
  );

describe('oauth-register function (RFC 7591)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    createClient.mockImplementation(async (reg) => ({
      clientId: 'mcp_abc', redirectUris: reg.redirectUris, clientName: reg.clientName, createdAt: 1_700_000_000_000,
    }));
  });

  it('registers a public client and returns its metadata', async () => {
    const res = await post({ client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], token_endpoint_auth_method: 'client_secret_post' });
    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      client_id: 'mcp_abc',
      client_id_issued_at: 1_700_000_000,
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    expect(initAdmin).toHaveBeenCalled();
  });

  it('checks the per-IP bucket and the global daily bucket', async () => {
    await post({ redirect_uris: ['https://a.example/cb'] });
    expect(checkRateLimit).toHaveBeenCalledWith('203.0.113.7', 'oauth-register-ip', 200, 3_600_000);
    expect(checkRateLimit).toHaveBeenCalledWith('global', 'oauth-register-global', 1000, 86_400_000);
  });

  it('returns 429 when a bucket is full, without registering', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterMs: 5000 });
    const res = await post({ redirect_uris: ['https://a.example/cb'] });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('fails closed (503) when the limiter is unavailable', async () => {
    checkRateLimit.mockRejectedValueOnce(new Error('firestore down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ redirect_uris: ['https://a.example/cb'] });
    expect(res.status).toBe(503);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects invalid metadata with the RFC 7591 error codes', async () => {
    const bad = await post({ redirect_uris: ['http://evil.example/cb'] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'invalid_redirect_uri' });

    const malformed = await post('{not json');
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: 'invalid_client_metadata' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns 500 when storing the client fails', async () => {
    createClient.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ redirect_uris: ['https://a.example/cb'] });
    expect(res.status).toBe(500);
  });

  it('answers preflight and refuses non-POST', async () => {
    expect((await handler(new Request('http://localhost/oauth/register', { method: 'OPTIONS' }), {} as any)).status).toBe(204);
    expect((await handler(new Request('http://localhost/oauth/register'), {} as any)).status).toBe(405);
  });
});
