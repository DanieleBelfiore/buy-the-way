import type { CatalogEntry } from './types';

const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

const score = (entry: CatalogEntry, now: number): number => {
  const ageMs = now - entry.lastUsedAt;
  return entry.usageCount * Math.exp((-ageMs * Math.LN2) / HALF_LIFE_MS);
};

export const rankCatalog = (entries: readonly CatalogEntry[], now: number): CatalogEntry[] =>
  [...entries].sort((a, b) => {
    const diff = score(b, now) - score(a, now);
    if (diff !== 0) return diff;
    return b.lastUsedAt - a.lastUsedAt;
  });
