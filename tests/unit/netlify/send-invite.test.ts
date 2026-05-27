import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken, listGet, userGet, emailsSend } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  listGet: vi.fn(),
  userGet: vi.fn(),
  emailsSend: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    auth: () => ({ verifyIdToken }),
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => {
          if (name === 'lists') {
            return { get: () => listGet(id) };
          }
          if (name === 'users') {
            return { get: () => userGet(id) };
          }
          throw new Error(`unexpected collection ${name}`);
        },
      }),
    }),
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: emailsSend };
    constructor(_apiKey: string) {}
  },
}));

vi.mock('@/../netlify/functions/_lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  rateLimitedResponse: vi.fn(),
  rateLimitUnavailableResponse: vi.fn(
    () => new Response(JSON.stringify({ error: 'rate_limit_unavailable' }), { status: 503 }),
  ),
  RATE_LIMITS: {
    sendInvite: { max: 20, windowMs: 3_600_000, funcName: 'send-invite' },
  },
}));

import { checkRateLimit, rateLimitUnavailableResponse } from '@/../netlify/functions/_lib/rate-limit';
import handler from '@/../netlify/functions/send-invite';

const LIST_ID = '01LIST00000000000000000001';
const ADMIN_UID = 'admin-uid';
const TOKEN = 'valid-token';

const post = (body: Record<string, unknown>, token = TOKEN): Promise<Response> =>
  handler(
    new Request('http://localhost/.netlify/functions/send-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }),
    {} as any,
  );

describe('send-invite function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['FIREBASE_SERVICE_ACCOUNT'] = JSON.stringify({ project_id: 'demo' });
    process.env['RESEND_API_KEY'] = 're_test';
    verifyIdToken.mockResolvedValue({ uid: ADMIN_UID });
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    listGet.mockImplementation(async (id: string) => {
      if (id !== LIST_ID) return { exists: false };
      return {
        exists: true,
        data: () => ({
          name: 'Spesa',
          ownerUid: ADMIN_UID,
          pendingInviteEmails: ['bob@example.com'],
        }),
      };
    });
    userGet.mockResolvedValue({
      data: () => ({ displayName: 'Alice Admin', email: 'alice@example.com' }),
    });
    emailsSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  });

  it('rejects requests without a bearer token', async () => {
    const res = await handler(
      new Request('http://localhost/.netlify/functions/send-invite', { method: 'POST' }),
      {} as any,
    );
    expect(res.status).toBe(401);
  });

  it('rejects non-admins even with a valid token', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'not-admin' });
    listGet.mockImplementation(async () => ({
      exists: true,
      data: () => ({
        name: 'Spesa',
        ownerUid: ADMIN_UID,
        pendingInviteEmails: ['bob@example.com'],
      }),
    }));

    const res = await post({
      email: 'bob@example.com',
      listId: LIST_ID,
      locale: 'en',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_list_admin' });
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('rejects when the email is not a pending invite on the list', async () => {
    listGet.mockImplementation(async () => ({
      exists: true,
      data: () => ({
        name: 'Spesa',
        ownerUid: ADMIN_UID,
        pendingInviteEmails: ['other@example.com'],
      }),
    }));

    const res = await post({
      email: 'bob@example.com',
      listId: LIST_ID,
      locale: 'en',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'invite_not_pending' });
    expect(emailsSend).not.toHaveBeenCalled();
  });

  it('derives list and inviter names from Firestore before sending', async () => {
    const res = await post({
      email: 'bob@example.com',
      listId: LIST_ID,
      locale: 'it',
    });

    expect(res.status).toBe(200);
    expect(emailsSend).toHaveBeenCalledOnce();
    const payload = emailsSend.mock.calls[0]![0] as {
      to: string[];
      subject: string;
      html: string;
    };
    expect(payload.to).toEqual(['bob@example.com']);
    expect(payload.subject).toContain('Alice Admin');
    expect(payload.html).toContain('Spesa');
  });

  it('fail-closes when the rate limiter is unavailable', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('firestore down'));

    const res = await post({
      email: 'bob@example.com',
      listId: LIST_ID,
      locale: 'en',
    });

    expect(res.status).toBe(503);
    expect(rateLimitUnavailableResponse).toHaveBeenCalled();
    expect(emailsSend).not.toHaveBeenCalled();
  });
});
