import { describe, it, expect, vi, beforeEach } from 'vitest';

const { revokeToken } = vi.hoisted(() => ({ revokeToken: vi.fn() }));

vi.mock('@/../netlify/functions/_lib/firebase-admin', () => ({ initAdmin: vi.fn() }));
vi.mock('@/../netlify/functions/_lib/oauth-store', () => ({ revokeToken }));

import handler from '@/../netlify/functions/oauth-revoke';

const post = (fields: Record<string, string>) =>
  handler(
    new Request('http://localhost/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    }),
    {} as any,
  );

describe('oauth-revoke function (RFC 7009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeToken.mockResolvedValue(undefined);
  });

  it('revokes and answers 200 with an empty body', async () => {
    const res = await post({ token: 'rt', token_type_hint: 'refresh_token', client_id: 'mcp_abc' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(revokeToken).toHaveBeenCalledWith('rt', 'mcp_abc');
  });

  it('works without client_id', async () => {
    await post({ token: 'rt' });
    expect(revokeToken).toHaveBeenCalledWith('rt', undefined);
  });

  it('requires the token parameter', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it('answers 503 when the store fails, so the client retries', async () => {
    revokeToken.mockRejectedValueOnce(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post({ token: 'rt' })).status).toBe(503);
  });

  it('answers preflight and refuses non-POST', async () => {
    expect((await handler(new Request('http://localhost/oauth/revoke', { method: 'OPTIONS' }), {} as any)).status).toBe(204);
    expect((await handler(new Request('http://localhost/oauth/revoke'), {} as any)).status).toBe(405);
  });
});
