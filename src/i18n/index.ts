import { createI18n } from 'vue-i18n';
import type { Locale } from '@/domain/types';
import en from './locales/en.json';
import it from './locales/it.json';
import legalEn from './locales/legal.en.json';
import legalIt from './locales/legal.it.json';
import { LOCALE_STORAGE_KEY, resolveInitialLocale } from './resolveLocale';

export { LOCALE_STORAGE_KEY, resolveInitialLocale, localeFromBrowserLanguage, resolveBrowserLocale } from './resolveLocale';

const FALLBACK: Locale = 'it';

const initialLocale = resolveInitialLocale();

const mergedEn = { ...en, ...legalEn };
const mergedIt = { ...it, ...legalIt };

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: FALLBACK,
  globalInjection: true,
  messages: { en: mergedEn, it: mergedIt },
});

export const setLocale = (locale: Locale): void => {
  (i18n.global.locale as { value: Locale }).value = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};
