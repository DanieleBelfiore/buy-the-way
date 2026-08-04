import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken, usersQueryGet } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  usersQueryGet: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => {
      if (name !== 'users') throw new Error(`unexpected collection ${name}`);
      return {
        where: () => ({
          limit: () => ({
            get: usersQueryGet,
          }),
        }),
      };
    },
  }),
}));

vi.mock('@/../netlify/functions/_lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  rateLimitedResponse: vi.fn(),
  RATE_LIMITS: {
    findUser: { max: 60, windowMs: 60_000, funcName: 'find-user' },
  },
}));

import handler from '@/../netlify/functions/find-user';

const get = (email: string, token?: string): Promise<Response> =>
  handler(
    new Request(
      `http://localhost/.netlify/functions/find-user?email=${encodeURIComponent(email)}`,
      token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    ),
    {} as any,
  );

describe('find-user function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['FIREBASE_SERVICE_ACCOUNT'] = JSON.stringify({ project_id: 'demo' });
    verifyIdToken.mockResolvedValue({ uid: 'caller-uid' });
    usersQueryGet.mockResolvedValue({ empty: true, docs: [] });
  });

  it('rejects non-GET methods', async () => {
    const res = await handler(
      new Request('http://localhost/.netlify/functions/find-user', { method: 'POST' }),
      {} as any,
    );
    expect(res.status).toBe(405);
  });

  it('rejects requests without a bearer token', async () => {
    const res = await get('bob@example.com');
    expect(res.status).toBe(401);
  });

  it('returns 400 when email param is missing', async () => {
    const res = await handler(
      new Request('http://localhost/.netlify/functions/find-user', {
        headers: { Authorization: 'Bearer tok' },
      }),
      {} as any,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'missing_email' });
  });

  it('returns null profile when no user matches', async () => {
    const res = await get('missing@example.com', 'tok');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile: null });
  });

  it('returns only invite-safe profile fields', async () => {
    usersQueryGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'bob-uid',
          data: () => ({
            uid: 'bob-uid',
            email: 'bob@example.com',
            displayName: 'Bob',
            photoURL: 'https://example.com/p.jpg',
            lastLoginAt: 999,
            defaultListId: 'secret-list',
          }),
        },
      ],
    });

    const res = await get('bob@example.com', 'tok');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      profile: {
        uid: 'bob-uid',
        email: 'bob@example.com',
        displayName: 'Bob',
        photoURL: 'https://example.com/p.jpg',
        lastLoginAt: 0,
      },
    });
  });
});
