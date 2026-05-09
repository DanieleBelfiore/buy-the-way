import { describe, it, expect, beforeEach } from 'vitest';
import { i18n, composer } from '@/i18n';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

void i18n;

type JsonTree = { [key: string]: JsonTree | string };

const BANNED_KEYS = ['continueApple', 'theme', 'light', 'dark', 'auto'] as const;

function collectKeyPaths(tree: JsonTree, prefix = ''): string[] {
  const out: string[] = [];
  for (const key of Object.keys(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = tree[key];
    if (value && typeof value === 'object') {
      out.push(...collectKeyPaths(value as JsonTree, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

function collectAllKeyNames(tree: JsonTree): string[] {
  const out: string[] = [];
  for (const key of Object.keys(tree)) {
    out.push(key);
    const value = tree[key];
    if (value && typeof value === 'object') {
      out.push(...collectAllKeyNames(value as JsonTree));
    }
  }
  return out;
}

describe('i18n locale parity', () => {
  it('it.json and en.json have identical key trees', () => {
    const itPaths = collectKeyPaths(itMessages as unknown as JsonTree);
    const enPaths = collectKeyPaths(enMessages as unknown as JsonTree);

    expect(enPaths).toEqual(itPaths);
  });

  it('contains zero banned keys in either locale', () => {
    const itAllKeys = collectAllKeyNames(itMessages as unknown as JsonTree);
    const enAllKeys = collectAllKeyNames(enMessages as unknown as JsonTree);

    for (const banned of BANNED_KEYS) {
      expect(itAllKeys).not.toContain(banned);
      expect(enAllKeys).not.toContain(banned);
    }
  });

  it('covers all 9 category enum values', () => {
    const required = [
      'fruit_vegetables',
      'dairy',
      'meat_fish',
      'bakery',
      'beverages',
      'frozen',
      'cleaning',
      'hygiene',
      'other',
    ];
    const itCategory = (itMessages as unknown as JsonTree).category as JsonTree;
    const enCategory = (enMessages as unknown as JsonTree).category as JsonTree;

    for (const key of required) {
      expect(itCategory[key]).toBeTypeOf('string');
      expect(enCategory[key]).toBeTypeOf('string');
    }
  });

  it('plural/template keys use vue-i18n {count} named param syntax', () => {
    const itTree = itMessages as unknown as JsonTree;
    const enTree = enMessages as unknown as JsonTree;

    const homeIt = itTree.home as JsonTree;
    const listIt = itTree.list as JsonTree;
    const commonIt = itTree.common as JsonTree;
    const homeEn = enTree.home as JsonTree;
    const listEn = enTree.list as JsonTree;
    const commonEn = enTree.common as JsonTree;

    expect(homeIt.lastsCount).toMatch(/\{count\}/);
    expect(homeEn.lastsCount).toMatch(/\{count\}/);
    expect(listIt.members).toMatch(/\{count\}/);
    expect(listEn.members).toMatch(/\{count\}/);
    expect(commonIt.updatedAgo).toMatch(/\{count\}/);
    expect(commonEn.updatedAgo).toMatch(/\{count\}/);
    expect(commonIt.deletedAgo).toMatch(/\{count\}/);
    expect(commonEn.deletedAgo).toMatch(/\{count\}/);
  });
});

describe('i18n instance', () => {
  beforeEach(() => {
    composer.locale.value = 'it';
  });

  it('is configured in Composition API mode with locale=it and fallback=en', () => {
    expect(composer.locale.value).toBe('it');
    expect(composer.fallbackLocale.value).toBe('en');
  });

  it('returns the english translation for app.title after switching locale', () => {
    composer.locale.value = 'en';
    expect(composer.t('app.title')).toBe(enMessages.app.title);
  });

  it('returns the italian translation for app.title by default', () => {
    expect(composer.t('app.title')).toBe(itMessages.app.title);
  });

  it('interpolates {count} named parameter for plural-style keys', () => {
    composer.locale.value = 'en';
    expect(composer.t('list.members', { count: 3 })).toBe('3 members');
    expect(composer.t('home.lastsCount', { count: 7 })).toBe('7 lists');
  });

  it('exposes mostUsedHelp explaining the always-visible Shelf', () => {
    composer.locale.value = 'en';
    const helpText = composer.t('list.mostUsedHelp');
    expect(helpText).toMatch(/shelf/i);
  });
});
