import type { CatalogEntry, Category, ItemPriority } from './types';

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

const priorityRank = (p: ItemPriority | undefined): number => {
  if (p === 'urgent') return 0;
  if (p === undefined) return 1;
  return 2;
};

export const sortItemsByPriorityThenName = <
  T extends { name: string; checked: boolean; priority?: ItemPriority },
>(
  items: readonly T[],
  locale: string,
): T[] => {
  const collator = new Intl.Collator(locale, COLLATOR_OPTS);
  return [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (rankDiff !== 0) return rankDiff;
    return collator.compare(a.name, b.name);
  });
};

export const groupCatalogByCategory = (
  entries: readonly CatalogEntry[],
  getLabel: (c: Category) => string,
  locale: string,
): Array<[Category, CatalogEntry[]]> => {
  const map = new Map<Category, CatalogEntry[]>();
  for (const entry of entries) {
    const bucket = map.get(entry.category);
    if (bucket) bucket.push(entry);
    else map.set(entry.category, [entry]);
  }
  const orderedCats = sortCategoriesByLabel([...map.keys()], getLabel, locale);
  return orderedCats.map((c) => [c, map.get(c)!]);
};
