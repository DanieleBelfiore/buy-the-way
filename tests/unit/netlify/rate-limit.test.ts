import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The helper drives a Firestore transaction. We mock the whole `firebase-admin`
 * surface used by the module so the test stays free of any network / SDK
 * initialisation. The transaction body is invoked synchronously with a fake
 * tx object - that's enough to verify the read/write decisions and the
 * shape of the response from `checkRateLimit`.
 */
const tx = {
  get: vi.fn(),
  set: vi.fn(),
};
const collectionDocSpy = vi.fn();
const runTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock('firebase-admin', () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => {
          collectionDocSpy(name, id);
          return { __ref: `${name}/${id}` };
        },
      }),
      runTransaction,
    }),
  },
}));

import {
  checkRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from '@/../netlify/functions/_lib/rate-limit';

describe('rate-limit helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows the first call and seeds the token bucket with count=1', async () => {
    tx.get.mockResolvedValue({ exists: false, data: () => null });
    const decision = await checkRateLimit('uid-1', 'find-user', 60, 60_000);

    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterMs).toBe(0);
    expect(tx.set).toHaveBeenCalledOnce();
    const [, payload] = tx.set.mock.calls[0]!;
    expect((payload as any).count).toBe(1);
    expect(typeof (payload as any).windowStart).toBe('number');
  });

  it('allows when count is below max and increments the counter', async () => {
    const now = Date.now();
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ windowStart: now - 1_000, count: 5 }),
    });

    const decision = await checkRateLimit('uid-1', 'find-user', 60, 60_000);

    expect(decision.allowed).toBe(true);
    expect(tx.set).toHaveBeenCalledOnce();
    const [, payload] = tx.set.mock.calls[0]!;
    expect((payload as any).count).toBe(6);
    // windowStart is preserved during the active window, not reset.
    expect((payload as any).windowStart).toBe(now - 1_000);
  });

  it('denies when count == max and reports retryAfterMs without writing', async () => {
    const now = Date.now();
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ windowStart: now - 10_000, count: 60 }),
    });

    const decision = await checkRateLimit('uid-1', 'find-user', 60, 60_000);

    expect(decision.allowed).toBe(false);
    // Roughly 50s left in the 60s window.
    expect(decision.retryAfterMs).toBeGreaterThan(40_000);
    expect(decision.retryAfterMs).toBeLessThanOrEqual(60_000);
    // No write on deny - saves quota and prevents counter inflation.
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('resets the bucket when the window has elapsed', async () => {
    const now = Date.now();
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ windowStart: now - 120_000, count: 60 }),
    });

    const decision = await checkRateLimit('uid-1', 'find-user', 60, 60_000);

    expect(decision.allowed).toBe(true);
    expect(tx.set).toHaveBeenCalledOnce();
    const [, payload] = tx.set.mock.calls[0]!;
    // Fresh window: count back to 1, windowStart bumped to now.
    expect((payload as any).count).toBe(1);
    expect((payload as any).windowStart).toBeGreaterThanOrEqual(now - 5);
  });

  it('namespaces the doc id by uid + funcName', async () => {
    tx.get.mockResolvedValue({ exists: false, data: () => null });
    await checkRateLimit('uid-7', 'send-invite', 20, 3_600_000);
    expect(collectionDocSpy).toHaveBeenCalledWith('rateLimits', 'uid-7_send-invite');
  });

  describe('rateLimitedResponse', () => {
    it('returns a 429 with a Retry-After header in seconds (rounded up)', async () => {
      const res = rateLimitedResponse({ allowed: false, retryAfterMs: 12_300 });
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('13');
      const body = await res.json();
      expect(body).toEqual({ error: 'rate_limited', retryAfterMs: 12_300 });
    });

    it('always reports at least 1 second so clients never read "0"', async () => {
      const res = rateLimitedResponse({ allowed: false, retryAfterMs: 50 });
      expect(res.headers.get('Retry-After')).toBe('1');
    });
  });

  describe('RATE_LIMITS constants', () => {
    it('caps find-user at 60 calls / minute', () => {
      expect(RATE_LIMITS.findUser).toMatchObject({
        max: 60,
        windowMs: 60_000,
        funcName: 'find-user',
      });
    });

    it('caps send-invite at 20 calls / hour', () => {
      expect(RATE_LIMITS.sendInvite).toMatchObject({
        max: 20,
        windowMs: 60 * 60 * 1000,
        funcName: 'send-invite',
      });
    });
  });
});
