import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateSignInWithEmailLink, emailsSend } = vi.hoisted(() => ({
  generateSignInWithEmailLink: vi.fn(),
  emailsSend: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ generateSignInWithEmailLink }),
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
    sendMagicLink: { max: 5, windowMs: 3_600_000, funcName: 'send-magic-link' },
  },
}));

import { checkRateLimit, rateLimitUnavailableResponse } from '@/../netlify/functions/_lib/rate-limit';
import handler from '@/../netlify/functions/send-magic-link';

const post = (body: Record<string, unknown>): Promise<Response> =>
  handler(
    new Request('http://localhost/.netlify/functions/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {} as any,
  );

describe('send-magic-link function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['FIREBASE_SERVICE_ACCOUNT'] = JSON.stringify({ project_id: 'demo' });
    process.env['RESEND_API_KEY'] = 're_test';
    process.env['APP_URL'] = 'https://app.example.com';
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    generateSignInWithEmailLink.mockResolvedValue('https://firebase.example/sign-in');
    emailsSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  });

  it('rejects invalid email', async () => {
    const res = await post({ email: 'not-an-email', locale: 'en' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_email' });
  });

  it('generates a sign-in link and sends via Resend', async () => {
    const res = await post({ email: 'bob@example.com', locale: 'en' });
    expect(res.status).toBe(200);
    expect(generateSignInWithEmailLink).toHaveBeenCalledWith(
      'bob@example.com',
      expect.objectContaining({
        url: 'https://app.example.com/auth/email-link-callback',
        handleCodeInApp: true,
      }),
    );
    expect(emailsSend).toHaveBeenCalledOnce();
  });

  it('allows localhost continue URLs in dev', async () => {
    await post({
      email: 'bob@example.com',
      locale: 'en',
      continueOrigin: 'http://localhost:5173',
    });
    expect(generateSignInWithEmailLink).toHaveBeenCalledWith(
      'bob@example.com',
      expect.objectContaining({
        url: 'http://localhost:5173/auth/email-link-callback',
      }),
    );
  });

  it('fail-closes when the rate limiter is unavailable', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('firestore down'));
    const res = await post({ email: 'bob@example.com', locale: 'en' });
    expect(res.status).toBe(503);
    expect(rateLimitUnavailableResponse).toHaveBeenCalled();
    expect(emailsSend).not.toHaveBeenCalled();
  });
});
