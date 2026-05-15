import { createI18n } from 'vue-i18n';
import type { Locale } from '@/domain/types';
import en from './locales/en.json';
import it from './locales/it.json';

const STORAGE_KEY = 'locale';
const FALLBACK: Locale = 'en';

const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null;
const browserLocale = navigator.language.startsWith('it') ? 'it' : 'en';
const initialLocale: Locale = savedLocale ?? browserLocale;

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: FALLBACK,
  globalInjection: true,
  messages: { en, it },
});

export const setLocale = (locale: Locale): void => {
  (i18n.global.locale as { value: Locale }).value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
};
