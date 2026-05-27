import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  localeFromBrowserLanguage,
  resolveBrowserLocale,
  resolveInitialLocale,
  LOCALE_STORAGE_KEY,
} from '@/i18n/resolveLocale';

describe('localeFromBrowserLanguage', () => {
  it('maps Italian tags to it', () => {
    expect(localeFromBrowserLanguage('it')).toBe('it');
    expect(localeFromBrowserLanguage('it-IT')).toBe('it');
  });

  it('maps English tags to en', () => {
    expect(localeFromBrowserLanguage('en')).toBe('en');
    expect(localeFromBrowserLanguage('en-US')).toBe('en');
  });

  it('returns null for unsupported languages', () => {
    expect(localeFromBrowserLanguage('de')).toBeNull();
    expect(localeFromBrowserLanguage('fr-FR')).toBeNull();
  });
});

describe('resolveBrowserLocale', () => {
  it('uses the first supported tag in preference order', () => {
    expect(resolveBrowserLocale(['de-DE', 'en-GB', 'it-IT'])).toBe('en');
    expect(resolveBrowserLocale(['de', 'it-CH'])).toBe('it');
  });

  it('falls back to en when no supported language is listed', () => {
    expect(resolveBrowserLocale(['de', 'fr'])).toBe('en');
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

  it('uses navigator languages when nothing is saved', () => {
    vi.stubGlobal('navigator', { language: 'it-IT', languages: ['it-IT', 'it'] });
    expect(resolveInitialLocale()).toBe('it');
  });

  it('uses navigator.language when languages is empty', () => {
    vi.stubGlobal('navigator', { language: 'en-GB', languages: [] });
    expect(resolveInitialLocale()).toBe('en');
  });

  it('falls back to default it when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    expect(resolveInitialLocale()).toBe('it');
  });
});
