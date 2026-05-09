import { describe, expect, test } from 'vitest';
import { CATEGORIES, i18nKey } from '@/domain/categories';
import type { Category } from '@/domain/types';

describe('CATEGORIES', () => {
  test('contains exactly nine members', () => {
    // Assert
    expect(CATEGORIES).toHaveLength(9);
  });

  test('lists every category in canonical order', () => {
    // Arrange
    const expected: readonly Category[] = [
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

    // Assert
    expect([...CATEGORIES]).toEqual([...expected]);
  });

  test('contains no duplicate values', () => {
    // Arrange + Act
    const unique = new Set<Category>(CATEGORIES);

    // Assert
    expect(unique.size).toBe(CATEGORIES.length);
  });
});

describe('i18nKey', () => {
  test('prefixes the category with `categories.`', () => {
    // Assert
    expect(i18nKey('dairy')).toBe('categories.dairy');
    expect(i18nKey('other')).toBe('categories.other');
  });

  test.each(CATEGORIES)('maps %s to its namespaced key', (cat) => {
    // Assert
    expect(i18nKey(cat)).toBe(`categories.${cat}`);
  });
});
