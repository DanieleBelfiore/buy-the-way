import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getAuthMock = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: () => getAuthMock(),
}));

import { notifyListEvent } from '@/services/notify.service';

describe('notify.service', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('no-ops cleanly when no user is signed in (fetch never called)', async () => {
    getAuthMock.mockReturnValue({ currentUser: null });
    await notifyListEvent({ listId: 'L1', kind: 'item-modified', itemId: 'I1' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('POSTs to /.netlify/functions/notify-list-event with the bearer token + sender locale', async () => {
    getAuthMock.mockReturnValue({
      currentUser: { getIdToken: vi.fn().mockResolvedValue('TOKEN_X') },
    });
    await notifyListEvent({ listId: 'L1', kind: 'item-modified', itemId: 'I1' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(url).toBe('/.netlify/functions/notify-list-event');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOKEN_X');
    const sentBody = JSON.parse(String((init as RequestInit).body));
    expect(sentBody).toMatchObject({
      listId: 'L1',
      kind: 'item-modified',
      itemId: 'I1',
      locale: expect.stringMatching(/^(it|en)$/),
    });
  });

  it('swallows network errors silently (best-effort)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getAuthMock.mockReturnValue({
      currentUser: { getIdToken: vi.fn().mockResolvedValue('TOK') },
    });
    vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));
    await expect(
      notifyListEvent({ listId: 'L1', kind: 'item-modified', itemId: 'I1' }),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
