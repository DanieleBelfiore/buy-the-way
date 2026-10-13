import type { CatalogEntry, Category, List } from './types';

export interface TopItem {
  readonly name: string;
  readonly category: Category;
  readonly usageCount: number;
}

export interface CategoryBreakdownSlice {
  readonly category: Category;
  readonly count: number;
  readonly share: number;
}

export interface StatsTotals {
  readonly listsCount: number;
  readonly uniqueCollaborators: number;
  readonly catalogEntries: number;
  readonly favorites: number;
  readonly totalUsage: number;
}

// `excluded` / `pinned` used to live on catalog entries and have since moved
// to the per-list favorite state, so `CatalogEntry` no longer declares them.
// Entries written before that move may still carry the flags.
type StatsEntry = CatalogEntry & {
  readonly excluded?: boolean;
  readonly pinned?: boolean;
};

const isCountable = (entry: StatsEntry): boolean =>
  !entry.excluded && entry.usageCount > 0;

export const topUsedItems = (
  entries: readonly StatsEntry[],
  limit = 10,
): TopItem[] => {
  return [...entries]
    .filter(isCountable)
    .sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(0, limit))
    .map((e) => ({
      name: e.name,
      category: e.category,
      usageCount: e.usageCount,
    }));
};

export const categoryBreakdown = (
  entries: readonly StatsEntry[],
): CategoryBreakdownSlice[] => {
  const counts = new Map<Category, number>();
  let total = 0;
  for (const e of entries) {
    if (!isCountable(e)) continue;
    counts.set(e.category, (counts.get(e.category) ?? 0) + e.usageCount);
    total += e.usageCount;
  }
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      share: count / total,
    }))
    .sort((a, b) => b.count - a.count);
};

export const computeTotals = (
  entries: readonly StatsEntry[],
  lists: readonly List[],
  selfUid: string | null,
  favoritesMinUses: number,
): StatsTotals => {
  const collaborators = new Set<string>();
  for (const l of lists) {
    for (const uid of l.collaboratorUids) {
      if (uid !== selfUid) collaborators.add(uid);
    }
  }
  let favorites = 0;
  let totalUsage = 0;
  for (const e of entries) {
    if (e.excluded) continue;
    totalUsage += e.usageCount;
    if (e.pinned || e.usageCount >= favoritesMinUses) favorites += 1;
  }
  return {
    listsCount: lists.length,
    uniqueCollaborators: collaborators.size,
    catalogEntries: entries.filter((e) => !e.excluded).length,
    favorites,
    totalUsage,
  };
};
