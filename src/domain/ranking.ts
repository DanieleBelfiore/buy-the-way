import type { CatalogEntry } from './types';

/**
 * Half-life of the recency weighting, expressed in days.
 *
 * After {@link halfLife} days have elapsed since `lastUsedAt`, an entry's
 * effective score is halved. Chosen as 30d so that monthly staples remain
 * prominent while one-off purchases naturally fade out of the suggestions.
 */
export const halfLife = 30;

const MS_PER_DAY = 86_400_000;

/**
 * Recency-weighted score for a single catalog entry.
 *
 * Formula: `score = usageCount * exp(-elapsedDays / halfLife)` where
 * `elapsedDays = max(0, (now - lastUsedAt) / MS_PER_DAY)`. Future timestamps
 * (clock skew) are clamped to 0 elapsed days so the score never exceeds
 * `usageCount`. Pure and deterministic.
 */
const scoreOf = (entry: CatalogEntry, now: number): number => {
  const elapsedMs = now - entry.lastUsedAt;
  const elapsedDays = elapsedMs > 0 ? elapsedMs / MS_PER_DAY : 0;
  return entry.usageCount * Math.exp(-elapsedDays / halfLife);
};

/**
 * Returns a new array of catalog entries sorted by recency-weighted score
 * (descending). Ties preserve the original input order (stable sort).
 *
 * Pure: never mutates the input. The output is a fresh `readonly` array.
 */
export const rankByRecency = (
  entries: readonly CatalogEntry[],
  now: number,
): readonly CatalogEntry[] => {
  return [...entries].sort((a, b) => scoreOf(b, now) - scoreOf(a, now));
};
