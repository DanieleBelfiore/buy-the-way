import type { Category } from './types';

/**
 * Canonical ordered tuple of every {@link Category} value.
 *
 * Order matches the visual order used in the category picker: produce first,
 * then fresh foods, pantry, household, with `other` as the catch-all. The
 * tuple is exported as `readonly` so consumers cannot mutate it.
 */
export const CATEGORIES = [
  'fruit_vegetables',
  'dairy',
  'meat_fish',
  'bakery',
  'beverages',
  'frozen',
  'cleaning',
  'hygiene',
  'other',
] as const satisfies readonly Category[];

/**
 * Returns the i18n message key for a given category.
 *
 * Convention: every category string is mirrored under the `categories.*`
 * namespace in the locale files (see `src/i18n/locales/*.json`).
 */
export const i18nKey = (cat: Category): string => `categories.${cat}`;
