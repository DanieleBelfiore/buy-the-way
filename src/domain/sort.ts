import type { Category } from './types';

const COLLATOR_OPTS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };

export const sortCategoriesByLabel = (
  categories: readonly Category[],
  getLabel: (c: Category) => string,
  locale: string,
): Category[] => {
  const collator = new Intl.Collator(locale, COLLATOR_OPTS);
  return [...categories].sort((a, b) => collator.compare(getLabel(a), getLabel(b)));
};

export const sortItemsByName = <T extends { name: string }>(
  items: readonly T[],
  locale: string,
): T[] => {
  const collator = new Intl.Collator(locale, COLLATOR_OPTS);
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
};

export const sortItemsCheckedThenName = <T extends { name: string; checked: boolean }>(
  items: readonly T[],
  locale: string,
): T[] => {
  const collator = new Intl.Collator(locale, COLLATOR_OPTS);
  return [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return collator.compare(a.name, b.name);
  });
};
