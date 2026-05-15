import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_ORDER, isCategoryValid } from '@/domain/categories';

describe('CATEGORIES', () => {
  it('exports all 9 canonical categories', () => {
    expect(Object.keys(CATEGORIES)).toHaveLength(9);
  });

  it('contains fruit_vegetables', () => {
    expect(CATEGORIES.fruit_vegetables).toBeDefined();
  });

  it('contains other', () => {
    expect(CATEGORIES.other).toBeDefined();
  });
});

describe('CATEGORY_ORDER', () => {
  it('has 9 entries', () => {
    expect(CATEGORY_ORDER).toHaveLength(9);
  });

  it('contains all category keys', () => {
    expect(CATEGORY_ORDER).toContain('fruit_vegetables');
    expect(CATEGORY_ORDER).toContain('dairy');
    expect(CATEGORY_ORDER).toContain('meat_fish');
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

  it('returns false for an unknown string', () => {
    expect(isCategoryValid('unknown')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCategoryValid('')).toBe(false);
  });
});
