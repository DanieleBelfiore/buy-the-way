import { describe, it, expect } from 'vitest';
import {
  sortCategoriesByLabel,
  sortItemsByName,
  sortItemsCheckedThenName,
  sortItemsByPriorityThenName,
  groupCatalogByCategory,
} from '@/domain/sort';
import type { Category, CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const makeEntry = (overrides: Partial<CatalogEntry> & { id: string }): CatalogEntry => ({
  id: overrides.id as ULID,
  ownerUid: 'uid-1',
  name: 'Item',
  category: 'other',
  usageCount: 1,
  lastUsedAt: 1000,
  ...overrides,
  id: overrides.id as ULID,
});

describe('sortCategoriesByLabel', () => {
  it('sorts by translated label alphabetically', () => {
    const labels: Record<Category, string> = {
      fruit_vegetables: 'Zucchine',
      dairy: 'Latticini',
      meat: 'Carne',
      fish: 'Pesce',
      bakery: 'Pane',
      beverages: 'Bevande',
      frozen: 'Surgelati',
      cleaning: 'Pulizie',
      hygiene: 'Igiene',
      other: 'Altro',
    };
    const cats: Category[] = ['fruit_vegetables', 'dairy', 'meat', 'bakery', 'other'];
    const sorted = sortCategoriesByLabel(cats, (c) => labels[c], 'it');
    const sortedLabels = sorted.map((c) => labels[c]);
    expect(sortedLabels).toEqual(['Altro', 'Carne', 'Latticini', 'Pane', 'Zucchine']);
  });

  it('respects locale collation (it)', () => {
    const labels: Record<Category, string> = {
      fruit_vegetables: 'Ä',
      dairy: 'B',
      meat: '',
      fish: '',
      bakery: '',
      beverages: '',
      frozen: '',
      cleaning: '',
      hygiene: '',
      other: '',
    };
    const cats: Category[] = ['fruit_vegetables', 'dairy'];
    const sorted = sortCategoriesByLabel(cats, (c) => labels[c], 'it');
    expect(sorted).toEqual(['fruit_vegetables', 'dairy']);
  });

  it('does not mutate input array', () => {
    const labels: Record<Category, string> = {
      fruit_vegetables: 'B',
      dairy: 'A',
      meat: '',
      fish: '',
      bakery: '',
      beverages: '',
      frozen: '',
      cleaning: '',
      hygiene: '',
      other: '',
    };
    const input: Category[] = ['fruit_vegetables', 'dairy'];
    sortCategoriesByLabel(input, (c) => labels[c], 'en');
    expect(input).toEqual(['fruit_vegetables', 'dairy']);
  });

  it('handles empty array', () => {
    expect(sortCategoriesByLabel([], () => '', 'en')).toEqual([]);
  });
});

describe('sortItemsByName', () => {
  it('sorts items alphabetically by name (locale-aware, case-insensitive)', () => {
    const items = [
      { name: 'Latte' },
      { name: 'Banana' },
      { name: 'Mela' },
      { name: 'Acqua' },
    ];
    const sorted = sortItemsByName(items, 'it');
    expect(sorted.map((i) => i.name)).toEqual(['Acqua', 'Banana', 'Latte', 'Mela']);
  });

  it('is case-insensitive (sensitivity base)', () => {
    const items = [{ name: 'banana' }, { name: 'Apple' }];
    const sorted = sortItemsByName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual(['Apple', 'banana']);
  });

  it('does not mutate input', () => {
    const input = [{ name: 'B' }, { name: 'A' }];
    sortItemsByName(input, 'en');
    expect(input.map((i) => i.name)).toEqual(['B', 'A']);
  });

  it('handles empty array', () => {
    expect(sortItemsByName([], 'en')).toEqual([]);
  });

  it('handles numeric tokens via numeric collation', () => {
    const items = [{ name: 'Item 10' }, { name: 'Item 2' }];
    const sorted = sortItemsByName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual(['Item 2', 'Item 10']);
  });
});

describe('sortItemsCheckedThenName', () => {
  it('puts unchecked first, sorts alphabetically within each group', () => {
    const items = [
      { name: 'Zen', checked: false },
      { name: 'Banana', checked: true },
      { name: 'Apple', checked: false },
      { name: 'Cookie', checked: true },
    ];
    const sorted = sortItemsCheckedThenName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual(['Apple', 'Zen', 'Banana', 'Cookie']);
  });

  it('all unchecked sort alphabetically', () => {
    const items = [
      { name: 'C', checked: false },
      { name: 'A', checked: false },
      { name: 'B', checked: false },
    ];
    const sorted = sortItemsCheckedThenName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });

  it('does not mutate input', () => {
    const input = [{ name: 'B', checked: false }, { name: 'A', checked: false }];
    sortItemsCheckedThenName(input, 'en');
    expect(input.map((i) => i.name)).toEqual(['B', 'A']);
  });
});

describe('sortItemsByPriorityThenName', () => {
  it('orders urgent before none before optional, alphabetical within each tier', () => {
    const items = [
      { name: 'Banana', checked: false, priority: undefined },
      { name: 'Apple', checked: false, priority: 'optional' as const },
      { name: 'Cherry', checked: false, priority: 'urgent' as const },
      { name: 'Almond', checked: false, priority: 'urgent' as const },
      { name: 'Date', checked: false, priority: undefined },
      { name: 'Beet', checked: false, priority: 'optional' as const },
    ];
    const sorted = sortItemsByPriorityThenName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual([
      'Almond',
      'Cherry',
      'Banana',
      'Date',
      'Apple',
      'Beet',
    ]);
  });

  it('keeps checked items at the bottom regardless of priority', () => {
    const items = [
      { name: 'A', checked: true, priority: 'urgent' as const },
      { name: 'B', checked: false, priority: 'optional' as const },
    ];
    const sorted = sortItemsByPriorityThenName(items, 'en');
    expect(sorted.map((i) => i.name)).toEqual(['B', 'A']);
  });

  it('does not mutate input', () => {
    const input = [
      { name: 'B', checked: false, priority: 'optional' as const },
      { name: 'A', checked: false, priority: 'urgent' as const },
    ];
    sortItemsByPriorityThenName(input, 'en');
    expect(input.map((i) => i.name)).toEqual(['B', 'A']);
  });
});

describe('groupCatalogByCategory', () => {
  const labels: Record<Category, string> = {
    fruit_vegetables: 'Frutta',
    dairy: 'Latticini',
    meat: 'Carne',
    fish: 'Pesce',
    bakery: 'Pane',
    beverages: 'Bevande',
    frozen: 'Surgelati',
    cleaning: 'Pulizie',
    hygiene: 'Igiene',
    other: 'Altro',
  };

  it('groups entries by category and orders groups alphabetically by label', () => {
    const entries: CatalogEntry[] = [
      makeEntry({ id: '01A', name: 'Latte', category: 'dairy' }),
      makeEntry({ id: '01B', name: 'Mela', category: 'fruit_vegetables' }),
      makeEntry({ id: '01C', name: 'Pane', category: 'bakery' }),
      makeEntry({ id: '01D', name: 'Yogurt', category: 'dairy' }),
    ];
    const groups = groupCatalogByCategory(entries, (c) => labels[c], 'it');
    const cats = groups.map(([c]) => c);
    // Frutta < Latticini < Pane
    expect(cats).toEqual(['fruit_vegetables', 'dairy', 'bakery']);
  });

  it('preserves input order within each group', () => {
    const entries: CatalogEntry[] = [
      makeEntry({ id: '01A', name: 'Yogurt', category: 'dairy' }),
      makeEntry({ id: '01B', name: 'Latte', category: 'dairy' }),
      makeEntry({ id: '01C', name: 'Burro', category: 'dairy' }),
    ];
    const groups = groupCatalogByCategory(entries, (c) => labels[c], 'it');
    expect(groups).toHaveLength(1);
    expect(groups[0][1].map((e) => e.name)).toEqual(['Yogurt', 'Latte', 'Burro']);
  });

  it('excludes empty categories', () => {
    const entries: CatalogEntry[] = [
      makeEntry({ id: '01A', name: 'Latte', category: 'dairy' }),
    ];
    const groups = groupCatalogByCategory(entries, (c) => labels[c], 'it');
    expect(groups.map(([c]) => c)).toEqual(['dairy']);
  });

  it('handles empty input', () => {
    expect(groupCatalogByCategory([], (c) => labels[c], 'it')).toEqual([]);
  });

  it('does not mutate input array', () => {
    const entries: CatalogEntry[] = [
      makeEntry({ id: '01A', name: 'B', category: 'dairy' }),
      makeEntry({ id: '01B', name: 'A', category: 'bakery' }),
    ];
    const snapshot = entries.map((e) => e.id);
    groupCatalogByCategory(entries, (c) => labels[c], 'it');
    expect(entries.map((e) => e.id)).toEqual(snapshot);
  });
});
