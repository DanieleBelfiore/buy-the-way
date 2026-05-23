import type { CatalogEntry } from './types';

export const FAVORITES_MIN_USES = 2;
export const FAVORITES_HALF_LIFE_DAYS = 30;
export const FAVORITES_MAX = 30;

const HALF_LIFE_MS = FAVORITES_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

const score = (entry: CatalogEntry, now: number): number => {
  const ageMs = now - entry.lastUsedAt;
  return entry.usageCount * Math.exp((-ageMs * Math.LN2) / HALF_LIFE_MS);
};

const sortByScoreDesc = (a: CatalogEntry, b: CatalogEntry, now: number): number => {
  const diff = score(b, now) - score(a, now);
  if (diff !== 0) return diff;
  return b.lastUsedAt - a.lastUsedAt;
};

/**
 * Rank catalog into the favorites shelf.
 *
 * Rules:
 * - `excluded` entries never appear.
 * - `pinned` entries always appear, sorted by score among themselves, listed first.
 *   Explicit pin overrides `dismissedFavorite` (re-pinning re-asserts the choice).
 * - Remaining entries must have `usageCount >= FAVORITES_MIN_USES` AND must not
 *   carry `dismissedFavorite` (sticky opt-out from auto-promotion).
 * - Combined output capped at FAVORITES_MAX (pinned entries are NOT counted against the cap
 *   so an aggressive pinner never loses them; non-pinned slots = max(0, cap - pinnedCount)).
 */
export const rankCatalog = (entries: readonly CatalogEntry[], now: number): CatalogEntry[] => {
  const visible = entries.filter((e) => !e.excluded);
  const pinned = visible.filter((e) => e.pinned).sort((a, b) => sortByScoreDesc(a, b, now));
  const candidates = visible
    .filter((e) => !e.pinned && !e.dismissedFavorite && e.usageCount >= FAVORITES_MIN_USES)
    .sort((a, b) => sortByScoreDesc(a, b, now));

  const slots = Math.max(0, FAVORITES_MAX - pinned.length);
  return [...pinned, ...candidates.slice(0, slots)];
};
