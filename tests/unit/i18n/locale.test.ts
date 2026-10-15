import { describe, it, expect } from 'vitest';
import en from '@/i18n/locales/en.json';
import itMessages from '@/i18n/locales/it.json';

describe('i18n locale files', () => {
  it('en and it have the same top-level keys', () => {
    const enKeys = Object.keys(en).sort();
    const itKeys = Object.keys(itMessages).sort();
    expect(enKeys).toEqual(itKeys);
  });
});
