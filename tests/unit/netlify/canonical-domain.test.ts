import { describe, it, expect } from 'vitest';
import indexHtml from '../../../index.html?raw';
import sitemap from '../../../public/sitemap.xml?raw';
import robots from '../../../public/robots.txt?raw';
import landing from '../../../src/views/LandingView.vue?raw';
import storageCors from '../../../firebase/storage.cors.json';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import { DEFAULT_APP_URL } from '@/../netlify/functions/_lib/branded-email';
import toml from '../../../netlify.toml?raw';

// The site moved to buytheway.app (tasks/domain-migration.md). Every
// user-facing absolute URL must use it; the old domain survives only as a
// redirect source in netlify.toml and as an allowed CORS origin.
const NEW = 'https://buytheway.app';
const OLD_HOST = 'buy-the-way.danielebelfiore.dev';

describe('canonical domain', () => {
  it('functions default to the new app URL (emails, MCP OAuth issuer)', () => {
    expect(DEFAULT_APP_URL).toBe(NEW);
  });

  it.each([
    ['index.html', indexHtml],
    ['sitemap.xml', sitemap],
    ['robots.txt', robots],
    ['LandingView.vue', landing],
    ['it.json', JSON.stringify(itLocale)],
    ['en.json', JSON.stringify(enLocale)],
  ])('%s uses only the new domain', (_name, content) => {
    expect(content).not.toContain(OLD_HOST);
  });

  it('points SEO metadata at the new domain', () => {
    expect(indexHtml).toContain(`<meta property="og:url" content="${NEW}" />`);
    expect(robots).toContain(`Sitemap: ${NEW}/sitemap.xml`);
    expect(sitemap).toContain(`<loc>${NEW}/</loc>`);
  });

  it('keeps the old origin in Storage CORS during the transition', () => {
    const origins = (storageCors as Array<{ origin: string[] }>)[0]!.origin;
    expect(origins).toContain(NEW);
    expect(origins).toContain(`https://${OLD_HOST}`);
  });

  it('redirects the old domain with a 301 that keeps the path', () => {
    expect(toml).toMatch(
      new RegExp(`from = "https://${OLD_HOST.replace(/\./g, '\\.')}/\\*"\\s+to = "${NEW}/:splat"\\s+status = 301\\s+force = true`),
    );
  });
});
