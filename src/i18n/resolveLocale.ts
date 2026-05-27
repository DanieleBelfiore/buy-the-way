import type { Locale } from '@/domain/types';

export const LOCALE_STORAGE_KEY = 'locale';

/** Fallback when storage and navigator are unavailable (tests, SSR). */
export const DEFAULT_LOCALE: Locale = 'it';

const isLocale = (value: string | null): value is Locale =>
  value === 'it' || value === 'en';

/**
 * Map a BCP-47 tag (e.g. `it-IT`, `en-US`) to a supported app locale, or
 * null when the language is not Italian or English.
 */
export const localeFromBrowserLanguage = (tag: string): Locale | null => {
  const base = tag.trim().toLowerCase().split('-')[0] ?? '';
  if (base === 'it') return 'it';
  if (base === 'en') return 'en';
  return null;
};

/** First supported locale in the user's preferred language list. */
export const resolveBrowserLocale = (languages: readonly string[]): Locale => {
  for (const tag of languages) {
    const match = localeFromBrowserLanguage(tag);
    if (match) return match;
  }
  return 'en';
};

/**
 * Initial UI locale: explicit user choice in localStorage, else OS/browser
 * languages, else {@link DEFAULT_LOCALE}.
 */
export const resolveInitialLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* private mode / disabled storage */
  }

  if (typeof navigator !== 'undefined') {
    const candidates = [
      ...(navigator.languages ?? []),
      navigator.language,
    ].filter((tag): tag is string => typeof tag === 'string' && tag.length > 0);
    if (candidates.length > 0) return resolveBrowserLocale(candidates);
  }

  return DEFAULT_LOCALE;
};
