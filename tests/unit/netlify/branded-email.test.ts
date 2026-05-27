import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_APP_URL,
  escapeHtml,
  joinPlainTextEmail,
  renderBrandedEmailHtml,
  resolveAppUrl,
} from '@/../netlify/functions/_lib/branded-email';

describe('branded-email _lib', () => {
  const prevAppUrl = process.env['APP_URL'];

  beforeEach(() => {
    delete process.env['APP_URL'];
  });

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env['APP_URL'];
    else process.env['APP_URL'] = prevAppUrl;
  });

  it('resolveAppUrl falls back to DEFAULT_APP_URL', () => {
    expect(resolveAppUrl()).toBe(DEFAULT_APP_URL);
  });

  it('resolveAppUrl prefers APP_URL env', () => {
    process.env['APP_URL'] = 'https://custom.example';
    expect(resolveAppUrl()).toBe('https://custom.example');
  });

  it('escapeHtml encodes dangerous characters', () => {
    expect(escapeHtml(`a&b<c>"'`)).toBe('a&amp;b&lt;c&gt;&quot;&#39;');
  });

  it('renderBrandedEmailHtml includes title, CTA, and logo from appUrl', () => {
    const html = renderBrandedEmailHtml({
      locale: 'en',
      title: 'Test title',
      preheader: 'Hidden preview',
      greeting: 'Hello',
      bodyHtml: '<p>Body</p>',
      ctaHref: 'https://app.example/open',
      ctaLabel: 'Open app',
      footer: 'Footer text',
      ignore: 'Ignore line',
      appUrl: 'https://app.example',
    });
    expect(html).toContain('lang="en"');
    expect(html).toContain('Test title');
    expect(html).toContain('https://app.example/branding/logo-original.png');
    expect(html).toContain('href="https://app.example/open"');
    expect(html).toContain('Open app');
    expect(html).toContain('Hidden preview');
  });

  it('joinPlainTextEmail appends a Buy The Way footer', () => {
    expect(joinPlainTextEmail(['Line 1', 'Line 2'])).toBe(
      'Line 1\nLine 2\n\n-- Buy The Way',
    );
  });
});
