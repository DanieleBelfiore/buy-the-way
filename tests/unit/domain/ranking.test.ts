import { describe, it, expect } from 'vitest';
import { rankCatalog } from '@/domain/ranking';
import type { CatalogEntry } from '@/domain/types';
import { newId } from '@/domain/id';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: newId(),
  ownerUid: 'user-1',
  name: 'Item',
  category: 'other',
  usageCount: 1,
  lastUsedAt: Date.now(),
  ...overrides,
});

describe('rankCatalog', () => {
  it('returns empty array for empty input', () => {
    expect(rankCatalog([], Date.now())).toEqual([]);
  });

  it('returns single entry unchanged', () => {
    const entry = makeEntry();
    const result = rankCatalog([entry], Date.now());
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(entry.id);
  });

  it('higher usageCount ranks first when age is equal', () => {
    const now = Date.now();
    const low = makeEntry({ usageCount: 1, lastUsedAt: now });
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

  it('very old entry scores near 0 but still included', () => {
    const now = Date.now();
    const ancient = makeEntry({
      usageCount: 100,
      lastUsedAt: now - 365 * 24 * 60 * 60 * 1000,
    });
    const fresh = makeEntry({ usageCount: 1, lastUsedAt: now });
    const result = rankCatalog([ancient, fresh], now);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(fresh.id);
  });

  it('handles all-zero usage (usageCount = 0)', () => {
    const now = Date.now();
    const a = makeEntry({ usageCount: 0, lastUsedAt: now - 1000 });
    const b = makeEntry({ usageCount: 0, lastUsedAt: now });
    const result = rankCatalog([a, b], now);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(b.id);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeEntry({ usageCount: 5 }),
      makeEntry({ usageCount: 1 }),
      makeEntry({ usageCount: 3 }),
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
