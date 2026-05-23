import { describe, it, expect } from 'vitest';
import {
  rankListFavorites,
  FAVORITES_MAX,
  FAVORITES_MIN_USES,
} from '@/domain/ranking';
import type { ListFavoriteState } from '@/domain/types';

const makeEntry = (overrides: Partial<ListFavoriteState> = {}): ListFavoriteState => {
  const slug = overrides.slug ?? `slug-${Math.random().toString(36).slice(2, 10)}`;
  return {
    slug,
    name: overrides.name ?? 'Item',
    category: overrides.category ?? 'other',
    usageCount: overrides.usageCount ?? FAVORITES_MIN_USES,
    lastUsedAt: overrides.lastUsedAt ?? Date.now(),
    ...(overrides.pinned !== undefined && { pinned: overrides.pinned }),
    ...(overrides.excluded !== undefined && { excluded: overrides.excluded }),
    ...(overrides.dismissedFavorite !== undefined && {
      dismissedFavorite: overrides.dismissedFavorite,
    }),
  };
};

describe('rankListFavorites', () => {
  it('returns empty array for empty input', () => {
    expect(rankListFavorites([], Date.now())).toEqual([]);
  });

  it('returns single entry meeting threshold', () => {
    const entry = makeEntry({ usageCount: FAVORITES_MIN_USES });
    const result = rankListFavorites([entry], Date.now());
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe(entry.slug);
  });

  it(`filters out entries with usageCount < ${FAVORITES_MIN_USES}`, () => {
    const below = makeEntry({ usageCount: FAVORITES_MIN_USES - 1 });
    const meets = makeEntry({ usageCount: FAVORITES_MIN_USES });
    const result = rankListFavorites([below, meets], Date.now());
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe(meets.slug);
  });

  it('higher usageCount ranks first when age is equal', () => {
    const now = Date.now();
    const low = makeEntry({ usageCount: FAVORITES_MIN_USES, lastUsedAt: now });
    const high = makeEntry({ usageCount: 10, lastUsedAt: now });
    const result = rankListFavorites([low, high], now);
    expect(result[0]?.slug).toBe(high.slug);
  });

  it('recent item outranks older item with same count', () => {
    const now = Date.now();
    const old = makeEntry({ usageCount: 5, lastUsedAt: now - 30 * 24 * 60 * 60 * 1000 });
    const recent = makeEntry({ usageCount: 5, lastUsedAt: now });
    const result = rankListFavorites([old, recent], now);
    expect(result[0]?.slug).toBe(recent.slug);
  });

  it('caps non-pinned results at FAVORITES_MAX', () => {
    const now = Date.now();
    const many = Array.from({ length: FAVORITES_MAX + 5 }, (_, i) =>
      makeEntry({ slug: `m-${i}`, usageCount: 5, lastUsedAt: now - i * 1000 }),
    );
    const result = rankListFavorites(many, now);
    expect(result.length).toBe(FAVORITES_MAX);
  });

  it('excluded entries are never returned', () => {
    const now = Date.now();
    const visible = makeEntry({ slug: 'v', usageCount: 5 });
    const hidden = makeEntry({ slug: 'h', usageCount: 100, excluded: true });
    const result = rankListFavorites([visible, hidden], now);
    expect(result.map((e) => e.slug)).not.toContain('h');
    expect(result).toHaveLength(1);
  });

  it('pinned entries appear even with usageCount below threshold', () => {
    const now = Date.now();
    const pinned = makeEntry({ usageCount: 0, pinned: true });
    const result = rankListFavorites([pinned], now);
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe(pinned.slug);
  });

  it('pinned entries are listed before non-pinned entries', () => {
    const now = Date.now();
    const popular = makeEntry({ slug: 'pop', usageCount: 50, lastUsedAt: now });
    const pinnedLowUse = makeEntry({
      slug: 'pin',
      usageCount: 0,
      pinned: true,
      lastUsedAt: now - 99999999,
    });
    const result = rankListFavorites([popular, pinnedLowUse], now);
    expect(result[0]?.slug).toBe('pin');
    expect(result[1]?.slug).toBe('pop');
  });

  it('pinned entries are not counted against the cap', () => {
    const now = Date.now();
    const pinned = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ slug: `p-${i}`, usageCount: 0, pinned: true, lastUsedAt: now }),
    );
    const candidates = Array.from({ length: FAVORITES_MAX }, (_, i) =>
      makeEntry({ slug: `c-${i}`, usageCount: 5, lastUsedAt: now }),
    );
    const result = rankListFavorites([...pinned, ...candidates], now);
    expect(result.filter((e) => e.pinned)).toHaveLength(5);
    expect(result.filter((e) => !e.pinned)).toHaveLength(FAVORITES_MAX - 5);
    expect(result).toHaveLength(FAVORITES_MAX);
  });

  it('excluded wins over pinned (excluded never shown)', () => {
    const now = Date.now();
    const ghost = makeEntry({ usageCount: 99, pinned: true, excluded: true });
    const result = rankListFavorites([ghost], now);
    expect(result).toEqual([]);
  });

  it('dismissedFavorite hides an auto-promoted (usage-based) entry from the shelf', () => {
    const now = Date.now();
    const dismissed = makeEntry({ usageCount: 50, dismissedFavorite: true });
    const result = rankListFavorites([dismissed], now);
    expect(result).toEqual([]);
  });

  it('explicit pin overrides dismissedFavorite (pinned still shown)', () => {
    const now = Date.now();
    const reasserted = makeEntry({
      usageCount: 5,
      pinned: true,
      dismissedFavorite: true,
    });
    const result = rankListFavorites([reasserted], now);
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe(reasserted.slug);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeEntry({ usageCount: 5 }),
      makeEntry({ usageCount: 3 }),
      makeEntry({ usageCount: 4 }),
    ];
    const original = [...entries];
    rankListFavorites(entries, Date.now());
    expect(entries[0]).toBe(original[0]);
  });

  it('returns a new array (not the same reference)', () => {
    const entries = [makeEntry()];
    const result = rankListFavorites(entries, Date.now());
    expect(result).not.toBe(entries);
  });
});
