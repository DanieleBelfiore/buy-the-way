import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_ORDER, isCategoryValid, migrateCategory } from '@/domain/categories';

describe('CATEGORIES', () => {
  it('exports all 10 canonical categories', () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(10);
  });

  it('contains fruit_vegetables', () => {
    expect(CATEGORIES.fruit_vegetables).toBeDefined();
  });

  it('splits meat and fish into separate entries', () => {
    expect(CATEGORIES.meat).toBeDefined();
    expect(CATEGORIES.fish).toBeDefined();
  });

  it('contains other', () => {
    expect(CATEGORIES.other).toBeDefined();
  });
});

describe('CATEGORY_ORDER', () => {
  it('has 10 entries', () => {
    expect(CATEGORY_ORDER).toHaveLength(10);
  });

  it('contains all category keys', () => {
    expect(CATEGORY_ORDER).toContain('fruit_vegetables');
    expect(CATEGORY_ORDER).toContain('dairy');
    expect(CATEGORY_ORDER).toContain('meat');
    expect(CATEGORY_ORDER).toContain('fish');
    expect(CATEGORY_ORDER).toContain('bakery');
    expect(CATEGORY_ORDER).toContain('beverages');
    expect(CATEGORY_ORDER).toContain('frozen');
    expect(CATEGORY_ORDER).toContain('cleaning');
    expect(CATEGORY_ORDER).toContain('hygiene');
    expect(CATEGORY_ORDER).toContain('other');
  });
});

describe('isCategoryValid', () => {
  it('returns true for a valid category', () => {
    expect(isCategoryValid('dairy')).toBe(true);
  });

  it('returns true for new meat / fish categories', () => {
    expect(isCategoryValid('meat')).toBe(true);
    expect(isCategoryValid('fish')).toBe(true);
  });

  it('returns false for legacy meat_fish', () => {
    expect(isCategoryValid('meat_fish')).toBe(false);
  });

  it('returns false for an unknown string', () => {
    expect(isCategoryValid('unknown')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCategoryValid('')).toBe(false);
  });
});

describe('migrateCategory', () => {
  it('maps legacy meat_fish to meat', () => {
    expect(migrateCategory('meat_fish')).toBe('meat');
  });

  it('passes through current categories unchanged', () => {
    expect(migrateCategory('dairy')).toBe('dairy');
    expect(migrateCategory('meat')).toBe('meat');
    expect(migrateCategory('fish')).toBe('fish');
  });

  it('falls back to other for unknown categories', () => {
    expect(migrateCategory('unknown')).toBe('other');
  });
});
