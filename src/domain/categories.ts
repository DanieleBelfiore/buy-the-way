import type { Category } from './types';

export const CATEGORIES: Record<Category, { labelKey: string; cssVar: string }> = {
  fruit_vegetables: { labelKey: 'category.fruit_vegetables', cssVar: 'var(--cat-fruit)' },
  dairy: { labelKey: 'category.dairy', cssVar: 'var(--cat-dairy)' },
  meat_fish: { labelKey: 'category.meat_fish', cssVar: 'var(--cat-meat)' },
  bakery: { labelKey: 'category.bakery', cssVar: 'var(--cat-bakery)' },
  beverages: { labelKey: 'category.beverages', cssVar: 'var(--cat-bev)' },
  frozen: { labelKey: 'category.frozen', cssVar: 'var(--cat-frozen)' },
  cleaning: { labelKey: 'category.cleaning', cssVar: 'var(--cat-clean)' },
  hygiene: { labelKey: 'category.hygiene', cssVar: 'var(--cat-hyg)' },
  other: { labelKey: 'category.other', cssVar: 'var(--cat-other)' },
};

export const CATEGORY_ORDER: readonly Category[] = [
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

const VALID_CATEGORIES = new Set<string>(CATEGORY_ORDER);

export const isCategoryValid = (value: string): value is Category =>
  VALID_CATEGORIES.has(value);
