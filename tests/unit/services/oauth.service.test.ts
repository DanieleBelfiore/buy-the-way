import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getIdToken = vi.fn();
let currentUser: { getIdToken: typeof getIdToken } | null = null;

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser }),
}));

import {
  pickOAuthParams,
  callOAuthAuthorize,
  navigateToClient,
  OAuthAuthorizeError,
} from '@/services/oauth.service';

const fetchMock = vi.fn();

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('oauth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    currentUser = { getIdToken };
    getIdToken.mockResolvedValue('id-tok');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('pickOAuthParams', () => {
    it('keeps only the OAuth parameters, first value, strings only', () => {
      expect(pickOAuthParams({
        client_id: 'c',
        state: ['s1', 's2'],
        code_challenge: 'x',
        evil: 'y',
        scope: null,
      })).toEqual({ client_id: 'c', state: 's1', code_challenge: 'x' });
    });
  });

  describe('callOAuthAuthorize', () => {
    it('posts the action with the ID token and returns the result', async () => {
      respond(200, { status: 'ok', clientName: 'Claude', redirectHost: 'claude.ai' });
      const r = await callOAuthAuthorize('describe', { client_id: 'c' });
      expect(r).toEqual({ status: 'ok', clientName: 'Claude', redirectHost: 'claude.ai' });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('/.netlify/functions/oauth-authorize');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer id-tok');
      expect(JSON.parse(init.body)).toEqual({ action: 'describe', params: { client_id: 'c' } });
    });

    it('returns the invalid result carried by a 400', async () => {
      respond(400, { status: 'invalid', reason: 'unknown_client' });
      expect(await callOAuthAuthorize('describe', {})).toEqual({ status: 'invalid', reason: 'unknown_client' });
    });

    it('throws when signed out', async () => {
      currentUser = null;
      await expect(callOAuthAuthorize('describe', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws on transport failure, other HTTP errors and unknown bodies', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('offline'));
      await expect(callOAuthAuthorize('approve', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
      respond(500, { error: 'internal_error' });
      await expect(callOAuthAuthorize('approve', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
      respond(429, { error: 'rate_limited' });
      await expect(callOAuthAuthorize('approve', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
      respond(200, { status: 'weird' });
      await expect(callOAuthAuthorize('approve', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
      fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
      await expect(callOAuthAuthorize('approve', {})).rejects.toBeInstanceOf(OAuthAuthorizeError);
    });
  });

  it('navigateToClient leaves the SPA with location.assign', () => {
    const original = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...original, assign }, configurable: true });
    try {
      navigateToClient('https://claude.ai/api/mcp/auth_callback?code=c');
      expect(assign).toHaveBeenCalledWith('https://claude.ai/api/mcp/auth_callback?code=c');
    } finally {
      Object.defineProperty(window, 'location', { value: original, configurable: true });
    }
  });
});
