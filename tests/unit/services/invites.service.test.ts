import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}));

import { getAuth } from 'firebase/auth';
import { sendInviteEmail, InviteEmailError } from '@/services/invites.service';

const mockGetAuth = vi.mocked(getAuth);

describe('sendInviteEmail', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when there is no signed-in user', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null } as any);
    await expect(
      sendInviteEmail({ email: 'a@b.com', listId: '01LIST', locale: 'en' }),
    ).rejects.toBeInstanceOf(InviteEmailError);
  });

  it('POSTs to /.netlify/functions/send-invite with the Firebase ID token', async () => {
    const getIdToken = vi.fn().mockResolvedValue('id-token-123');
    mockGetAuth.mockReturnValue({ currentUser: { getIdToken } } as any);

    await sendInviteEmail({
      email: 'bob@example.com',
      listId: '01LIST00000000000000000001',
      locale: 'it',
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/.netlify/functions/send-invite');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer id-token-123');
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({
      email: 'bob@example.com',
      listId: '01LIST00000000000000000001',
      locale: 'it',
    });
  });

  it('throws InviteEmailError with code + status on non-2xx response', async () => {
    mockGetAuth.mockReturnValue({
      currentUser: { getIdToken: vi.fn().mockResolvedValue('tok') },
    } as any);
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValue({ error: 'send_failed' }),
    });

    try {
      await sendInviteEmail({ email: 'a@b.com', listId: '01LIST', locale: 'en' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InviteEmailError);
      expect((err as InviteEmailError).status).toBe(502);
      expect((err as InviteEmailError).code).toBe('send_failed');
    }
  });

  it('still throws when the error body is not JSON', async () => {
    mockGetAuth.mockReturnValue({
      currentUser: { getIdToken: vi.fn().mockResolvedValue('tok') },
    } as any);
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    });

    await expect(
      sendInviteEmail({ email: 'a@b.com', listId: '01LIST', locale: 'en' }),
    ).rejects.toMatchObject({ status: 500 });
  });
});
