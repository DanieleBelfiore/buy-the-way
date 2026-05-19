import { describe, it, expect } from 'vitest';
import {
  PUBLIC_CATALOG,
  iconForName,
  isCustomItemName,
  findPublicEntryByName,
  getPublicCatalogName,
  GENERIC_ITEM_ICON,
  normalizeName,
} from '@/domain/public-catalog';
import { CATEGORY_ORDER } from '@/domain/categories';
import type { Category } from '@/domain/types';

describe('PUBLIC_CATALOG', () => {
  it('has at least 150 entries', () => {
    expect(PUBLIC_CATALOG.length).toBeGreaterThanOrEqual(150);
  });

  it('covers every category', () => {
    const present = new Set<Category>(PUBLIC_CATALOG.map((e) => e.category));
    for (const c of CATEGORY_ORDER) {
      expect(present.has(c)).toBe(true);
    }
  });

  it('every entry has slug, name_it, name_en, category', () => {
    for (const e of PUBLIC_CATALOG) {
      expect(e.slug.length).toBeGreaterThan(0);
      expect(e.name_it.length).toBeGreaterThan(0);
      expect(e.name_en.length).toBeGreaterThan(0);
      expect(CATEGORY_ORDER).toContain(e.category);
    }
  });

  it('slugs are unique', () => {
    const slugs = PUBLIC_CATALOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('getPublicCatalogName', () => {
  it('returns name_it for it locale', () => {
    const entry = PUBLIC_CATALOG.find((e) => e.slug === 'latte')!;
    expect(getPublicCatalogName(entry, 'it')).toBe('Latte');
  });

  it('returns name_en for en locale', () => {
    const entry = PUBLIC_CATALOG.find((e) => e.slug === 'latte')!;
    expect(getPublicCatalogName(entry, 'en')).toBe('Milk');
  });

  it('falls back to en for unknown locales', () => {
    const entry = PUBLIC_CATALOG.find((e) => e.slug === 'latte')!;
    expect(getPublicCatalogName(entry, 'fr')).toBe('Milk');
  });
});

describe('normalizeName', () => {
  it('strips diacritics, trims, lowercases', () => {
    expect(normalizeName('  Caffè  ')).toBe('caffe');
    expect(normalizeName('Mélange')).toBe('melange');
  });
});

describe('findPublicEntryByName', () => {
  it('finds entry by exact localized name (it)', () => {
    const result = findPublicEntryByName('Latte', 'it');
    expect(result?.slug).toBe('latte');
  });

  it('finds entry case-insensitively', () => {
    const result = findPublicEntryByName('MILK', 'en');
    expect(result?.slug).toBe('latte');
  });

  it('returns undefined for unknown name', () => {
    expect(findPublicEntryByName('xyznotreal', 'it')).toBeUndefined();
  });
});

describe('iconForName', () => {
  it('returns the catalog icon for known names', () => {
    expect(iconForName('Latte', 'it')).toBe('🥛');
    expect(iconForName('Milk', 'en')).toBe('🥛');
  });

  it('returns generic icon for unknown names', () => {
    expect(iconForName('Tofu fritto', 'it')).toBe(GENERIC_ITEM_ICON);
  });
});

describe('isCustomItemName', () => {
  it('returns false for empty name', () => {
    expect(isCustomItemName('')).toBe(false);
    expect(isCustomItemName('   ')).toBe(false);
  });

  it('returns false for IT name in public catalog (Latte)', () => {
    expect(isCustomItemName('Latte')).toBe(false);
  });

  it('returns false for EN name in public catalog (Milk)', () => {
    expect(isCustomItemName('Milk')).toBe(false);
  });

  it('is locale-agnostic — Latte not custom even with en locale arg', () => {
    expect(isCustomItemName('Latte', 'en')).toBe(false);
  });

  it('returns true for name not in any locale', () => {
    expect(isCustomItemName('Babà')).toBe(true);
    expect(isCustomItemName('Zarbo')).toBe(true);
  });

  it('matches case-insensitively via normalizeName', () => {
    expect(isCustomItemName('LATTE')).toBe(false);
    expect(isCustomItemName('milk')).toBe(false);
  });
});
