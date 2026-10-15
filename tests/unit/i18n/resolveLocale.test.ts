import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveBrowserLocale,
  resolveInitialLocale,
  LOCALE_STORAGE_KEY
} from '@/i18n/resolveLocale';

describe('resolveBrowserLocale', () => {
  it('uses the first supported tag in preference order', () => {
    expect(resolveBrowserLocale(['de-DE', 'en-GB', 'it-IT'])).toBe('en');
    expect(resolveBrowserLocale(['de', 'it-CH'])).toBe('it');
  });
});

describe('resolveInitialLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', {
      language: 'en-US',
      languages: ['en-US', 'en'],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers a saved locale over the system language', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'it');
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['en-US'] });
    expect(resolveInitialLocale()).toBe('it');
  });

  it('falls back to default it when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    expect(resolveInitialLocale()).toBe('it');
  });
});
