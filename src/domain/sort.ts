import type { Category, ItemPriority } from './types';

const COLLATOR_OPTS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };

export const sortCategoriesByLabel = (
  categories: readonly Category[],
  getLabel: (c: Category) => string,
  locale: string,
): Category[] => {
  const collator = new Intl.Collator(locale, COLLATOR_OPTS);
  return [...categories].sort((a, b) => collator.compare(getLabel(a), getLabel(b)));
};

/**
 * Order `categories` according to an optional per-list `preferredOrder`,
 * with categories absent from the preference falling back to alphabetic
 * label-order at the tail.
 *
 * - Duplicates in `preferredOrder` are ignored (first occurrence wins).
 * - Entries in `preferredOrder` that are NOT in `categories` are skipped.
 * - Categories in `categories` that are NOT in `preferredOrder` are
 *   appended after the preferred block, sorted by translated label.
 */
export const sortCategoriesWithPreference = (
  categories: readonly Category[],
  preferredOrder: readonly Category[] | undefined,
  getLabel: (c: Category) => string,
  locale: string,
): Category[] => {
  const present = new Set<Category>(categories);
  if (!preferredOrder || preferredOrder.length === 0) {
    return sortCategoriesByLabel(categories, getLabel, locale);
  }
  const seen = new Set<Category>();
  const head: Category[] = [];
  for (const c of preferredOrder) {
    if (!present.has(c) || seen.has(c)) continue;
    head.push(c);
    seen.add(c);
  }
  const tail = sortCategoriesByLabel(
    [...present].filter((c) => !seen.has(c)),
    getLabel,
    locale,
  );
  return [...head, ...tail];
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

/**
 * Group catalog-like entries by their `category` field, returning groups in
 * alphabetical order by translated category label. Generic over any entry
 * shape carrying a `category` so the same helper serves both the per-user
 * `CatalogEntry` and the per-list `ListFavoriteState`.
 */
export const groupCatalogByCategory = <T extends { category: Category }>(
  entries: readonly T[],
  getLabel: (c: Category) => string,
  locale: string,
): Array<[Category, T[]]> => {
  const map = new Map<Category, T[]>();
  for (const entry of entries) {
    const bucket = map.get(entry.category);
    if (bucket) bucket.push(entry);
    else map.set(entry.category, [entry]);
  }
  const orderedCats = sortCategoriesByLabel([...map.keys()], getLabel, locale);
  return orderedCats.map((c) => [c, map.get(c)!]);
};
