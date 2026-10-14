import { describe, it, expect } from 'vitest';
import { pwaManifest, pwaOptions } from '@/pwa/manifest';

describe('pwaManifest', () =>
{
  it('has required identity fields', () =>
  {
    expect(pwaManifest.name).toBe('Buy The Way');
    expect(pwaManifest.short_name).toBe('Buy The Way');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.scope).toBe('/');
  });

  it('uses brand colors and standalone display', () =>
  {
    expect(pwaManifest.theme_color).toBe('#f7f4ed');
    expect(pwaManifest.background_color).toBe('#f7f4ed');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.orientation).toBe('portrait');
  });

  it('declares 192 + 512 (maskable) + apple-touch icons', () =>
  {
    const sizes = pwaManifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    const has512Maskable = pwaManifest.icons.some(
      (i) => i.sizes === '512x512' && i.purpose?.includes('maskable'),
    );
    expect(has512Maskable).toBe(true);
    const hasAppleTouch = pwaManifest.icons.some((i) => i.sizes === '180x180');
    expect(hasAppleTouch).toBe(true);
  });

  it('icon src paths point to /icons/', () =>
  {
    for (const icon of pwaManifest.icons)
    {
      expect(icon.src.startsWith('/icons/')).toBe(true);
    }
  });
});

describe('pwaOptions', () =>
{
  it('uses prompt registerType (manual update flow)', () =>
  {
    expect(pwaOptions.registerType).toBe('prompt');
  });

  it('disables PWA generation in dev to avoid SW conflicts', () =>
  {
    expect(pwaOptions.devOptions?.enabled).toBe(false);
  });

  it('embeds the manifest', () =>
  {
    expect(pwaOptions.manifest).toBe(pwaManifest);
  });

  it('runtime-caches Google Fonts (network-first stylesheet)', () =>
  {
    const runtime = pwaOptions.workbox?.runtimeCaching ?? [];
    const fonts = runtime.find((r) => (r.urlPattern as RegExp).test('https://fonts.googleapis.com/css2?family=X'));
    expect(fonts).toBeDefined();
  });

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
