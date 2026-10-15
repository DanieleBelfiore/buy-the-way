import { describe, it, expect } from 'vitest';
import { pwaOptions } from '@/pwa/manifest';

describe('pwaOptions', () =>
{
  it('does not cache Firestore endpoints (delegated to SDK)', () =>
  {
    const navFallbackDenylist = (pwaOptions.workbox?.navigateFallbackDenylist ?? []) as RegExp[];
    const hasFirestore = navFallbackDenylist.some((re) =>
      re.test('https://firestore.googleapis.com/v1/projects/x'),
    );
    expect(hasFirestore).toBe(true);
  });

  it('never answers MCP / OAuth server paths with the SPA shell, but keeps the consent screen', () =>
  {
    const deny = (pwaOptions.workbox?.navigateFallbackDenylist ?? []) as RegExp[];
    const denied = (path: string) => deny.some((re) => re.test(path));
    expect(denied('/mcp')).toBe(true);
    expect(denied('/.well-known/oauth-protected-resource')).toBe(true);
    expect(denied('/oauth/token')).toBe(true);
    expect(denied('/oauth/register')).toBe(true);
    expect(denied('/oauth/revoke')).toBe(true);
    expect(denied('/oauth/authorize?client_id=x')).toBe(false);
    expect(denied('/lists/abc')).toBe(false);
  });

  it('does not precache the retiring service worker of the old domain', () =>
  {
    expect(pwaOptions.workbox?.globIgnores ?? []).toContain('**/sw-retire.js');
  });
});
