import { createI18n } from 'vue-i18n';
import type { Locale } from '@/domain/types';
import en from './locales/en.json';
import it from './locales/it.json';
import legalEn from './locales/legal.en.json';
import legalIt from './locales/legal.it.json';

const STORAGE_KEY = 'locale';
const DEFAULT: Locale = 'it';
const FALLBACK: Locale = 'it';

const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null;
const initialLocale: Locale = savedLocale ?? DEFAULT;

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
  localStorage.setItem(STORAGE_KEY, locale);
};
