import { describe, it, expect } from 'vitest';
import toml from '../../../netlify.toml?raw';

// Netlify applies the first matching [[redirects]] rule, so every function
// rewrite must sit above the SPA catch-all or it silently serves index.html.
const froms = [...toml.matchAll(/^\s*from\s*=\s*"([^"]+)"/gm)].map((m) => m[1]!);
const catchAll = froms.indexOf('/*');

describe('netlify.toml redirects', () => {
  it('has the SPA catch-all', () => {
    expect(catchAll).toBeGreaterThan(-1);
  });

  it.each([
    '/__/auth/*',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/*',
    '/.well-known/*',
    '/oauth/register',
    '/oauth/token',
    '/oauth/revoke',
    '/mcp',
  ])('routes %s before the SPA catch-all', (from) => {
    const at = froms.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(catchAll);
  });

  it('leaves /oauth/authorize to the SPA (consent screen)', () => {
    expect(froms.some((f) => f.startsWith('/oauth/authorize'))).toBe(false);
  });

  it('keeps the specific .well-known rules above the .well-known 404', () => {
    const wildcard = froms.indexOf('/.well-known/*');
    expect(froms.indexOf('/.well-known/oauth-authorization-server')).toBeLessThan(wildcard);
    expect(froms.indexOf('/.well-known/oauth-protected-resource/*')).toBeLessThan(wildcard);
  });

  describe('retired domain (tasks/domain-migration.md)', () => {
    const OLD = 'https://buy-the-way.danielebelfiore.dev';

    it('handles the old host before every other rule', () => {
      expect(froms[0]).toBe(`${OLD}/sw.js`);
      expect(froms[1]).toBe(`${OLD}/*`);
    });

    it('serves the retiring service worker on the old host, not a redirect', () => {
      expect(toml).toMatch(/from = "https:\/\/buy-the-way\.danielebelfiore\.dev\/sw\.js"\s+to = "\/sw-retire\.js"\s+status = 200\s+force = true/);
    });
  });
});
