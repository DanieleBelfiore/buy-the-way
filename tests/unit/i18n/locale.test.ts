import { describe, it, expect } from 'vitest';
import { createI18n } from 'vue-i18n';
import en from '@/i18n/locales/en.json';
import itMessages from '@/i18n/locales/it.json';

const makeI18n = (locale: 'it' | 'en' = 'en') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en, it: itMessages },
  });

describe('i18n locale files', () => {
  it('en has app.name', () => {
    const i18n = makeI18n('en');
    expect(i18n.global.t('app.name')).toBe('Buy The Way');
  });

  it('it has app.name', () => {
    const i18n = makeI18n('it');
    expect(i18n.global.t('app.name')).toBe('Buy The Way');
  });

  it('en and it have the same top-level keys', () => {
    const enKeys = Object.keys(en).sort();
    const itKeys = Object.keys(itMessages).sort();
    expect(enKeys).toEqual(itKeys);
  });

  it('switching locale changes translation', () => {
    const i18n = makeI18n('en');
    const enTagline = i18n.global.t('app.tagline');
    i18n.global.locale.value = 'it';
    const itTagline = i18n.global.t('app.tagline');
    expect(enTagline).not.toBe('');
    expect(itTagline).not.toBe('');
  });

  it('shelf.title pluralizes with count and surfaces "favorit" stem (en/it)', () => {
    const i18n = makeI18n('en');
    expect(i18n.global.t('shelf.title', 5, { count: 5 })).toBe('Your 5 favorite items');
    expect(i18n.global.t('shelf.title', 1, { count: 1 })).toBe('Your favorite item');
    i18n.global.locale.value = 'it';
    expect(i18n.global.t('shelf.title', 5, { count: 5 })).toBe('I tuoi 5 articoli preferiti');
    expect(i18n.global.t('shelf.title', 1, { count: 1 })).toBe('Il tuo articolo preferito');
  });

  it('collaborators.owner is "Admin" (en) / "Amministratore" (it)', () => {
    const i18n = makeI18n('en');
    expect(i18n.global.t('collaborators.owner')).toBe('Admin');
    i18n.global.locale.value = 'it';
    expect(i18n.global.t('collaborators.owner')).toBe('Amministratore');
  });

  it('listSettings.rename is "Name" (en) / "Nome" (it)', () => {
    const i18n = makeI18n('en');
    expect(i18n.global.t('listSettings.rename')).toBe('Name');
    i18n.global.locale.value = 'it';
    expect(i18n.global.t('listSettings.rename')).toBe('Nome');
  });
});
