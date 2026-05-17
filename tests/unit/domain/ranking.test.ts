import { describe, it, expect } from 'vitest';
import {
  rankCatalog,
  FAVORITES_MAX,
  FAVORITES_MIN_USES,
} from '@/domain/ranking';
import type { CatalogEntry } from '@/domain/types';
import { newId } from '@/domain/id';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: newId(),
  ownerUid: 'user-1',
  name: 'Item',
  category: 'other',
  usageCount: FAVORITES_MIN_USES,
  lastUsedAt: Date.now(),
  ...overrides,
});

describe('rankCatalog', () => {
  it('returns empty array for empty input', () => {
    expect(rankCatalog([], Date.now())).toEqual([]);
  });

  it('returns single entry meeting threshold', () => {
    const entry = makeEntry({ usageCount: FAVORITES_MIN_USES });
    const result = rankCatalog([entry], Date.now());
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(entry.id);
  });

  it(`filters out entries with usageCount < ${FAVORITES_MIN_USES}`, () => {
    const below = makeEntry({ usageCount: FAVORITES_MIN_USES - 1 });
    const meets = makeEntry({ usageCount: FAVORITES_MIN_USES });
    const result = rankCatalog([below, meets], Date.now());
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(meets.id);
  });

  it('higher usageCount ranks first when age is equal', () => {
    const now = Date.now();
    const low = makeEntry({ usageCount: FAVORITES_MIN_USES, lastUsedAt: now });
    const high = makeEntry({ usageCount: 10, lastUsedAt: now });
    const result = rankCatalog([low, high], now);
    expect(result[0]?.id).toBe(high.id);
  });

  it('recent item outranks older item with same count', () => {
    const now = Date.now();
    const old = makeEntry({ usageCount: 5, lastUsedAt: now - 30 * 24 * 60 * 60 * 1000 });
    const recent = makeEntry({ usageCount: 5, lastUsedAt: now });
    const result = rankCatalog([old, recent], now);
    expect(result[0]?.id).toBe(recent.id);
  });

  it('very old entry scores near 0 but still included if meets count', () => {
    const now = Date.now();
    const ancient = makeEntry({
      usageCount: 100,
      lastUsedAt: now - 365 * 24 * 60 * 60 * 1000,
    });
    const fresh = makeEntry({ usageCount: 5, lastUsedAt: now });
    const result = rankCatalog([ancient, fresh], now);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(fresh.id);
  });

  it('caps non-pinned results at FAVORITES_MAX', () => {
    const now = Date.now();
    const many = Array.from({ length: FAVORITES_MAX + 5 }, (_, i) =>
      makeEntry({ usageCount: 5, lastUsedAt: now - i * 1000 }),
    );
    const result = rankCatalog(many, now);
    expect(result.length).toBe(FAVORITES_MAX);
  });

  it('excluded entries are never returned', () => {
    const now = Date.now();
    const visible = makeEntry({ usageCount: 5 });
    const hidden = makeEntry({ usageCount: 100, excluded: true });
    const result = rankCatalog([visible, hidden], now);
    expect(result.map((e) => e.id)).not.toContain(hidden.id);
    expect(result).toHaveLength(1);
  });

  it('pinned entries appear even with usageCount below threshold', () => {
    const now = Date.now();
    const pinned = makeEntry({ usageCount: 0, pinned: true });
    const result = rankCatalog([pinned], now);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(pinned.id);
  });

  it('pinned entries are listed before non-pinned entries', () => {
    const now = Date.now();
    const popular = makeEntry({ usageCount: 50, lastUsedAt: now });
    const pinnedLowUse = makeEntry({ usageCount: 0, pinned: true, lastUsedAt: now - 99999999 });
    const result = rankCatalog([popular, pinnedLowUse], now);
    expect(result[0]?.id).toBe(pinnedLowUse.id);
    expect(result[1]?.id).toBe(popular.id);
  });

  it('pinned entries are not counted against the cap', () => {
    const now = Date.now();
    const pinned = Array.from({ length: 5 }, () =>
      makeEntry({ usageCount: 0, pinned: true, lastUsedAt: now }),
    );
    const candidates = Array.from({ length: FAVORITES_MAX }, () =>
      makeEntry({ usageCount: 5, lastUsedAt: now }),
    );
    const result = rankCatalog([...pinned, ...candidates], now);
    expect(result.filter((e) => e.pinned)).toHaveLength(5);
    expect(result.filter((e) => !e.pinned)).toHaveLength(FAVORITES_MAX - 5);
    expect(result).toHaveLength(FAVORITES_MAX);
  });

  it('excluded wins over pinned (excluded never shown)', () => {
    const now = Date.now();
    const ghost = makeEntry({ usageCount: 99, pinned: true, excluded: true });
    const result = rankCatalog([ghost], now);
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeEntry({ usageCount: 5 }),
      makeEntry({ usageCount: 3 }),
      makeEntry({ usageCount: 4 }),
    ];
    const original = [...entries];
    rankCatalog(entries, Date.now());
    expect(entries[0]).toBe(original[0]);
  });

  it('returns a new array (not the same reference)', () => {
    const entries = [makeEntry()];
    const result = rankCatalog(entries, Date.now());
    expect(result).not.toBe(entries);
  });
});
