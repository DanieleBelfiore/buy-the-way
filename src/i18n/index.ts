import { createI18n, type Composer } from 'vue-i18n';
import it from './locales/it.json';
import en from './locales/en.json';

type MessageSchema = typeof it;
export type Locale = 'it' | 'en';

const i18nRaw = createI18n({
  legacy: false,
  locale: 'it',
  fallbackLocale: 'en',
  messages: {
    it,
    en,
  },
});

export const i18n = i18nRaw;

export type AppComposer = Composer<
  { it: MessageSchema; en: MessageSchema },
  Record<string, unknown>,
  Record<string, unknown>,
  Locale
>;

export const composer = i18nRaw.global as unknown as AppComposer;
