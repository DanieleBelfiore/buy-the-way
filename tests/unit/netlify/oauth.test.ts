import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generateToken,
  hashToken,
  verifyPkceS256,
  isAllowedRedirectUri,
  redirectUriMatches,
  validateClientRegistration,
  canonicalResource,
  isValidResource,
  buildRedirect,
  parseFormOrJson,
  oauthJson,
  oauthError,
  oauthPreflight,
  OAUTH_TTL,
} from '@/../netlify/functions/_lib/oauth';

const b64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('oauth lib', () => {
  describe('generateToken / hashToken', () => {
    it('generates 256-bit base64url tokens that never repeat', () => {
      const a = generateToken();
      const b = generateToken();
      expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(a).not.toBe(b);
    });

    it('hashes to sha256 hex, deterministic', () => {
      expect(hashToken('abc')).toBe(createHash('sha256').update('abc').digest('hex'));
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });
  });

  describe('verifyPkceS256', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = b64url(createHash('sha256').update(verifier).digest());

    it('accepts the RFC 7636 appendix B pair', () => {
      expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
      expect(verifyPkceS256(verifier, challenge)).toBe(true);
    });

    it('rejects a wrong verifier', () => {
      expect(verifyPkceS256(`${verifier.slice(0, -1)}x`, challenge)).toBe(false);
    });

    it('rejects verifiers outside 43-128 unreserved chars', () => {
      expect(verifyPkceS256('short', b64url(createHash('sha256').update('short').digest()))).toBe(false);
      const long = 'a'.repeat(129);
      expect(verifyPkceS256(long, b64url(createHash('sha256').update(long).digest()))).toBe(false);
      const bad = `${'a'.repeat(42)}!`;
      expect(verifyPkceS256(bad, b64url(createHash('sha256').update(bad).digest()))).toBe(false);
    });

    it('rejects a challenge of a different length without throwing', () => {
      expect(verifyPkceS256(verifier, 'abc')).toBe(false);
    });
  });

  describe('isAllowedRedirectUri', () => {
    it.each([
      'https://claude.ai/api/mcp/auth_callback',
      'http://localhost:7777/oauth/callback',
      'http://127.0.0.1:53682/callback',
      'http://[::1]:8080/cb',
      'http://localhost/callback',
    ])('accepts %s', (uri) => {
      expect(isAllowedRedirectUri(uri)).toBe(true);
    });

    it.each([
      'http://example.com/cb',
      'https://example.com/cb#frag',
      'javascript:alert(1)',
      'ftp://example.com/cb',
      'not a url',
      `https://example.com/${'a'.repeat(2050)}`,
      'https://user:pass@example.com/cb',
    ])('rejects %s', (uri) => {
      expect(isAllowedRedirectUri(uri)).toBe(false);
    });
  });

  describe('redirectUriMatches', () => {
    it('requires an exact match for https URIs', () => {
      const reg = ['https://claude.ai/api/mcp/auth_callback'];
      expect(redirectUriMatches(reg, 'https://claude.ai/api/mcp/auth_callback')).toBe(true);
      expect(redirectUriMatches(reg, 'https://claude.ai/api/mcp/auth_callback?x=1')).toBe(false);
      expect(redirectUriMatches(reg, 'https://evil.example/api/mcp/auth_callback')).toBe(false);
    });

    it('ignores the port for loopback URIs (RFC 8252 section 7.3)', () => {
      const reg = ['http://127.0.0.1:1234/callback'];
      expect(redirectUriMatches(reg, 'http://127.0.0.1:5555/callback')).toBe(true);
      expect(redirectUriMatches(reg, 'http://127.0.0.1:5555/other')).toBe(false);
      expect(redirectUriMatches(reg, 'http://localhost:5555/callback')).toBe(false);
    });

    it('rejects unparseable input', () => {
      expect(redirectUriMatches(['https://a.example/cb'], 'nope')).toBe(false);
    });
  });

  describe('validateClientRegistration', () => {
    it('accepts a minimal public client and defaults its metadata', () => {
      const r = validateClientRegistration({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] });
      expect(r).toEqual({
        ok: true,
        value: { redirectUris: ['https://claude.ai/api/mcp/auth_callback'], clientName: 'MCP client' },
      });
    });

    it('sanitizes client_name (no urls, bounded length)', () => {
      const r = validateClientRegistration({
        redirect_uris: ['http://localhost:7777/cb'],
        client_name: `Claude Code https://evil.example ${'x'.repeat(200)}`,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.clientName).not.toContain('https://');
      expect(r.value.clientName.length).toBeLessThanOrEqual(80);
    });

    it.each([
      [{}, 'redirect_uris'],
      [{ redirect_uris: [] }, 'redirect_uris'],
      [{ redirect_uris: 'https://a.example/cb' }, 'redirect_uris'],
      [{ redirect_uris: ['http://evil.example/cb'] }, 'redirect_uris'],
      [{ redirect_uris: Array.from({ length: 11 }, (_, i) => `https://a.example/${i}`) }, 'redirect_uris'],
      [{ redirect_uris: ['https://a.example/cb'], grant_types: ['client_credentials'] }, 'grant_types'],
      [{ redirect_uris: ['https://a.example/cb'], response_types: ['token'] }, 'response_types'],
      [null, 'body'],
    ])('rejects %j', (body, field) => {
      const r = validateClientRegistration(body);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe(field === 'redirect_uris' ? 'invalid_redirect_uri' : 'invalid_client_metadata');
    });
  });

  describe('resource', () => {
    it('builds the canonical MCP resource from the app url', () => {
      expect(canonicalResource('https://app.example')).toBe('https://app.example/mcp');
      expect(canonicalResource('https://app.example/')).toBe('https://app.example/mcp');
    });

    it('accepts a missing resource or the canonical one (trailing slash tolerated)', () => {
      expect(isValidResource(undefined, 'https://app.example')).toBe(true);
      expect(isValidResource('https://app.example/mcp', 'https://app.example')).toBe(true);
      expect(isValidResource('https://app.example/mcp/', 'https://app.example')).toBe(true);
      expect(isValidResource('https://other.example/mcp', 'https://app.example')).toBe(false);
    });
  });

  describe('buildRedirect', () => {
    it('appends params and preserves existing query', () => {
      const url = buildRedirect('https://a.example/cb?x=1', { code: 'c', state: 's&t' });
      const parsed = new URL(url);
      expect(parsed.searchParams.get('x')).toBe('1');
      expect(parsed.searchParams.get('code')).toBe('c');
      expect(parsed.searchParams.get('state')).toBe('s&t');
    });

    it('omits undefined params (state is optional)', () => {
      expect(new URL(buildRedirect('https://a.example/cb', { code: 'c', state: undefined })).searchParams.has('state')).toBe(false);
    });
  });

  describe('parseFormOrJson', () => {
    it('parses application/x-www-form-urlencoded', async () => {
      const req = new Request('http://x/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&code=abc',
      });
      expect(await parseFormOrJson(req)).toEqual({ grant_type: 'authorization_code', code: 'abc' });
    });

    it('parses JSON and keeps only string values', async () => {
      const req = new Request('http://x/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'refresh_token', n: 1 }),
      });
      expect(await parseFormOrJson(req)).toEqual({ grant_type: 'refresh_token' });
    });

    it('returns an empty object on a malformed body', async () => {
      const req = new Request('http://x/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      expect(await parseFormOrJson(req)).toEqual({});
    });
  });

  describe('responses', () => {
    it('oauthJson is uncacheable and CORS-open (no credentials)', async () => {
      const res = oauthJson(200, { a: 1 });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(await res.json()).toEqual({ a: 1 });
    });

    it('oauthError uses the RFC 6749 body shape', async () => {
      const res = oauthError(400, 'invalid_grant', 'expired');
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_grant', error_description: 'expired' });
    });

    it('oauthPreflight answers 204 with the allowed methods and headers', () => {
      const res = oauthPreflight('GET, POST');
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });
  });

  it('exposes the agreed token lifetimes', () => {
    expect(OAUTH_TTL.codeMs).toBe(60_000);
    expect(OAUTH_TTL.accessMs).toBe(60 * 60 * 1000);
    expect(OAUTH_TTL.refreshMs).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
