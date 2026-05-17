import { describe, it, expect } from 'vitest';
import {
  sortCategoriesByLabel,
  sortItemsByName,
  sortItemsCheckedThenName,
} from '@/domain/sort';
import type { Category } from '@/domain/types';

describe('sortCategoriesByLabel', () => {
  it('sorts by translated label alphabetically', () => {
    const labels: Record<Category, string> = {
      fruit_vegetables: 'Zucchine',
      dairy: 'Latticini',
      meat_fish: 'Carne',
      bakery: 'Pane',
      beverages: 'Bevande',
      frozen: 'Surgelati',
      cleaning: 'Pulizie',
      hygiene: 'Igiene',
      other: 'Altro',
    };
    const cats: Category[] = ['fruit_vegetables', 'dairy', 'meat_fish', 'bakery', 'other'];
    const sorted = sortCategoriesByLabel(cats, (c) => labels[c], 'it');
    const sortedLabels = sorted.map((c) => labels[c]);
    expect(sortedLabels).toEqual(['Altro', 'Carne', 'Latticini', 'Pane', 'Zucchine']);
  });

  it('respects locale collation (it)', () => {
    const labels: Record<Category, string> = {
      fruit_vegetables: 'Ä',
      dairy: 'B',
      meat_fish: '',
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
      meat_fish: '',
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
