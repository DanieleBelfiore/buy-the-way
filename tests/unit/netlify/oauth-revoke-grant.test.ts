import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken, revokeGrantOf, checkRateLimit } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  revokeGrantOf: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/../netlify/functions/_lib/firebase-admin', () => ({ initAdmin: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock('@/../netlify/functions/_lib/oauth-store', () => ({ revokeGrantOf }));
vi.mock('@/../netlify/functions/_lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/../netlify/functions/_lib/rate-limit')>()),
  checkRateLimit,
}));

import handler from '@/../netlify/functions/oauth-revoke-grant';

const call = (body: unknown, token: string | null = 'id-token', method = 'POST') =>
  handler(
    new Request('http://localhost/.netlify/functions/oauth-revoke-grant', {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    }),
    {} as any,
  );

describe('oauth-revoke-grant function (Connected apps)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockResolvedValue({ uid: 'me' });
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    revokeGrantOf.mockResolvedValue(true);
  });

  it('requires a valid Firebase ID token', async () => {
    expect((await call({ grantId: 'G1' }, null)).status).toBe(401);
    verifyIdToken.mockRejectedValueOnce(new Error('expired'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await call({ grantId: 'G1' })).status).toBe(401);
    expect(revokeGrantOf).not.toHaveBeenCalled();
  });

  it('revokes the caller\'s grant, scoped to the verified uid', async () => {
    const res = await call({ grantId: 'G1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'revoked' });
    expect(revokeGrantOf).toHaveBeenCalledWith('me', 'G1');
  });

  it('answers 404 for a grant that is missing or not the caller\'s', async () => {
    revokeGrantOf.mockResolvedValueOnce(false);
    const res = await call({ grantId: 'someone-elses' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('rejects a malformed body before touching the store', async () => {
    for (const body of ['not json', {}, { grantId: 42 }, { grantId: '' }, { grantId: 'x'.repeat(129) }]) {
      expect((await call(body)).status).toBe(400);
    }
    expect(revokeGrantOf).not.toHaveBeenCalled();
  });

});
