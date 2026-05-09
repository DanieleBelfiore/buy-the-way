import { describe, expect, test } from 'vitest';
import { newId } from '@/domain/id';
import { halfLife, rankByRecency } from '@/domain/ranking';
import type { CatalogEntry } from '@/domain/types';

const MS_PER_DAY = 86_400_000;
const NOW = 1_700_000_000_000;

const makeEntry = (name: string, usageCount: number, lastUsedAt: number): CatalogEntry => ({
  id: newId(),
  ownerUid: 'uid_owner',
  name,
  category: 'other',
  usageCount,
  lastUsedAt,
});

describe('halfLife', () => {
  test('is exposed as 30 days', () => {
    // Assert
    expect(halfLife).toBe(30);
  });
});

describe('rankByRecency', () => {
  test('returns an empty array when given no entries', () => {
    // Assert
    expect(rankByRecency([], NOW)).toEqual([]);
  });

  test('does not mutate the input array', () => {
    // Arrange
    const a = makeEntry('a', 1, NOW);
    const b = makeEntry('b', 5, NOW);
    const input: readonly CatalogEntry[] = [a, b];

    // Act
    const ranked = rankByRecency(input, NOW);

    // Assert
    expect(input).toEqual([a, b]);
    expect(ranked).not.toBe(input);
  });

  test('sorts by usageCount when timestamps tie', () => {
    // Arrange
    const low = makeEntry('low', 1, NOW);
    const high = makeEntry('high', 10, NOW);
    const mid = makeEntry('mid', 4, NOW);

    // Act
    const ranked = rankByRecency([low, high, mid], NOW);

    // Assert
    expect(ranked.map((e) => e.name)).toEqual(['high', 'mid', 'low']);
  });

  test('penalises older entries via the exp(-elapsed/halfLife) decay', () => {
    // Arrange
    // After exactly halfLife days, the older entry's score halves.
    // older.score = 10 * exp(-1) ~= 3.68 ; recent.score = 4 * 1 = 4 -> recent wins.
    const older = makeEntry('older', 10, NOW - halfLife * MS_PER_DAY);
    const recent = makeEntry('recent', 4, NOW);

    // Act
    const ranked = rankByRecency([older, recent], NOW);

    // Assert
    expect(ranked[0]?.name).toBe('recent');
    expect(ranked[1]?.name).toBe('older');
  });

  test('keeps high-usage older entries above low-usage recent ones when decay is small', () => {
    // Arrange
    // 1 day elapsed => decay ~= exp(-1/30) ~= 0.967.
    // older.score = 100 * 0.967 ~= 96.7 ; recent.score = 1 -> older wins.
    const older = makeEntry('older', 100, NOW - MS_PER_DAY);
    const recent = makeEntry('recent', 1, NOW);

    // Act
    const ranked = rankByRecency([older, recent], NOW);

    // Assert
    expect(ranked[0]?.name).toBe('older');
  });

  test('clamps future timestamps so the score never exceeds usageCount', () => {
    // Arrange
    // lastUsedAt > now (clock skew). elapsedMs <= 0 -> elapsedDays = 0 -> score = usageCount.
    const future = makeEntry('future', 3, NOW + MS_PER_DAY);
    const present = makeEntry('present', 5, NOW);

    // Act
    const ranked = rankByRecency([future, present], NOW);

    // Assert
    expect(ranked.map((e) => e.name)).toEqual(['present', 'future']);
  });

  test('treats zero usageCount as a zero score regardless of recency', () => {
    // Arrange
    const zero = makeEntry('zero', 0, NOW);
    const tiny = makeEntry('tiny', 1, NOW - 365 * MS_PER_DAY);

    // Act
    const ranked = rankByRecency([zero, tiny], NOW);

    // Assert
    expect(ranked[0]?.name).toBe('tiny');
    expect(ranked[1]?.name).toBe('zero');
  });

  test('is deterministic for identical inputs', () => {
    // Arrange
    const entries: readonly CatalogEntry[] = [
      makeEntry('a', 3, NOW - 5 * MS_PER_DAY),
      makeEntry('b', 7, NOW - 10 * MS_PER_DAY),
      makeEntry('c', 2, NOW),
    ];

    // Act
    const first = rankByRecency(entries, NOW).map((e) => e.name);
    const second = rankByRecency(entries, NOW).map((e) => e.name);

    // Assert
    expect(first).toEqual(second);
  });
});
