import { describe, it, expect } from 'vitest';
import {
  topUsedItems,
  categoryBreakdown,
  computeTotals,
} from '@/domain/stats';
import type { CatalogEntry, List } from '@/domain/types';
import type { ULID } from '@/domain/id';

const e = (overrides: Partial<CatalogEntry>): CatalogEntry => ({
  id: 'id' as ULID,
  ownerUid: 'u',
  name: 'item',
  category: 'other',
  usageCount: 1,
  lastUsedAt: 0,
  ...overrides,
});

const l = (overrides: Partial<List>): List => ({
  id: 'lid' as ULID,
  name: 'L',
  ownerUid: 'self',
  collaboratorUids: ['self'],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('topUsedItems', () => {
  it('returns entries sorted by usageCount desc, name asc', () => {
    const result = topUsedItems([
      e({ name: 'Milk', usageCount: 5 }),
      e({ name: 'Bread', usageCount: 10 }),
      e({ name: 'Apple', usageCount: 5 }),
    ]);
    expect(result.map((r) => r.name)).toEqual(['Bread', 'Apple', 'Milk']);
  });

  it('caps the result at limit', () => {
    const entries = Array.from({ length: 15 }, (_, i) =>
      e({ name: `Item${i}`, usageCount: i + 1 }),
    );
    expect(topUsedItems(entries, 3)).toHaveLength(3);
  });

  it('excludes entries with excluded=true', () => {
    const result = topUsedItems([
      e({ name: 'Hidden', usageCount: 99, excluded: true }),
      e({ name: 'Visible', usageCount: 1 }),
    ]);
    expect(result.map((r) => r.name)).toEqual(['Visible']);
  });

  it('excludes entries with usageCount 0', () => {
    const result = topUsedItems([
      e({ name: 'Zero', usageCount: 0 }),
      e({ name: 'One', usageCount: 1 }),
    ]);
    expect(result.map((r) => r.name)).toEqual(['One']);
  });

  it('returns empty when no entries', () => {
    expect(topUsedItems([])).toEqual([]);
  });

  it('handles limit=0', () => {
    expect(topUsedItems([e({ usageCount: 5 })], 0)).toEqual([]);
  });
});

describe('categoryBreakdown', () => {
  it('aggregates usageCount per category and computes share', () => {
    const result = categoryBreakdown([
      e({ category: 'dairy', usageCount: 3 }),
      e({ category: 'dairy', usageCount: 2 }),
      e({ category: 'meat', usageCount: 5 }),
    ]);
    expect(result).toEqual([
      { category: 'dairy', count: 5, share: 0.5 },
      { category: 'meat', count: 5, share: 0.5 },
    ]);
  });

  it('sorts slices by count desc', () => {
    const result = categoryBreakdown([
      e({ category: 'dairy', usageCount: 1 }),
      e({ category: 'meat', usageCount: 9 }),
    ]);
    expect(result.map((s) => s.category)).toEqual(['meat', 'dairy']);
  });

  it('returns empty when total is zero', () => {
    expect(categoryBreakdown([])).toEqual([]);
    expect(
      categoryBreakdown([e({ usageCount: 5, excluded: true })]),
    ).toEqual([]);
  });
});

describe('computeTotals', () => {
  it('counts lists, unique non-self collaborators, catalog entries, favorites', () => {
    const result = computeTotals(
      [
        e({ usageCount: 6, pinned: true }),
        e({ usageCount: 4 }),
        e({ usageCount: 2 }),
        e({ usageCount: 1, excluded: true }),
      ],
      [
        l({ collaboratorUids: ['self', 'bob'] }),
        l({ collaboratorUids: ['self', 'carl', 'bob'] }),
      ],
      'self',
      4,
    );
    expect(result.listsCount).toBe(2);
    expect(result.uniqueCollaborators).toBe(2); // bob + carl
    expect(result.catalogEntries).toBe(3); // excludes excluded
    expect(result.favorites).toBe(2); // pinned + one with usageCount >= 4
    expect(result.totalUsage).toBe(12); // 6 + 4 + 2 (excluded skipped)
  });

  it('handles null selfUid (counts everyone)', () => {
    const result = computeTotals(
      [],
      [l({ collaboratorUids: ['alice', 'bob'] })],
      null,
      3,
    );
    expect(result.uniqueCollaborators).toBe(2);
  });

  it('returns zeros for empty input', () => {
    const result = computeTotals([], [], 'self', 4);
    expect(result).toEqual({
      listsCount: 0,
      uniqueCollaborators: 0,
      catalogEntries: 0,
      favorites: 0,
      totalUsage: 0,
    });
  });
});
