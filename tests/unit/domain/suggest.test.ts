import { describe, it, expect } from 'vitest';
import {
  buildSuggestions,
  SUGGEST_MIN_RUNS,
  SUGGEST_FREQUENCY_WINDOW,
} from '@/domain/suggest';
import type { Category, Item, ListHistoryEntry } from '@/domain/types';

const DAY = 24 * 60 * 60 * 1000;
// Local noon keeps every "N days ago" timestamp on a distinct calendar day
// regardless of the timezone the suite runs in.
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
const daysAgo = (n: number): number => NOW - n * DAY;

type Row = string | { name: string; category?: Category; quantity?: string; checked?: boolean };

let seq = 0;
const makeItem = (row: Row): Item => {
  const r = typeof row === 'string' ? { name: row } : row;
  seq += 1;
  return {
    id: `item-${seq}`,
    listId: 'list-1',
    name: r.name,
    quantity: r.quantity ?? '',
    category: r.category ?? 'other',
    note: '',
    checked: r.checked ?? true,
    createdByUid: 'u1',
    createdAt: 0,
    updatedAt: 0,
  };
};

const run = (
  completedAt: number,
  rows: Row[],
  trigger: ListHistoryEntry['trigger'] = 'completion',
): ListHistoryEntry => {
  const items = rows.map(makeItem);
  seq += 1;
  return {
    id: `run-${seq}`,
    listId: 'list-1',
    completedAt,
    itemCount: items.length,
    recordedByUid: 'u1',
    trigger,
    items,
  };
};

const find = (result: ReturnType<typeof buildSuggestions>, name: string) =>
  result.suggestions.find((s) => s.name === name);

describe('buildSuggestions', () => {
  it('returns nothing for an empty history', () => {
    expect(buildSuggestions([], [], NOW)).toEqual({ runCount: 0, suggestions: [] });
  });

  it(`returns no suggestions below ${SUGGEST_MIN_RUNS} runs`, () => {
    const result = buildSuggestions([run(daysAgo(7), ['Latte'])], [], NOW);
    expect(result.runCount).toBe(1);
    expect(result.suggestions).toEqual([]);
  });

  it('preselects an item bought on every run', () => {
    const history = [
      run(daysAgo(21), ['Latte']),
      run(daysAgo(14), ['Latte']),
      run(daysAgo(7), ['Latte']),
    ];
    const latte = find(buildSuggestions(history, [], NOW), 'Latte');
    expect(latte?.preselected).toBe(true);
    expect(latte?.purchaseCount).toBe(3);
    expect(latte?.intervalDays).toBe(7);
  });

  it('preselects an every-run item even when the last run was yesterday', () => {
    const history = [
      run(daysAgo(15), ['Latte']),
      run(daysAgo(8), ['Latte']),
      run(daysAgo(1), ['Latte']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Latte')?.preselected).toBe(true);
  });

  it('shows but does not preselect an every-other-run item bought on the last run', () => {
    const history = [
      run(daysAgo(28), ['Pane', 'Sale']),
      run(daysAgo(21), ['Pane']),
      run(daysAgo(14), ['Pane', 'Sale']),
      run(daysAgo(7), ['Pane']),
      run(daysAgo(1), ['Pane', 'Sale']),
    ];
    const sale = find(buildSuggestions(history, [], NOW), 'Sale');
    expect(sale).toBeDefined();
    expect(sale?.preselected).toBe(false);
  });

  it('preselects an every-other-run item skipped on the last run', () => {
    const history = [
      run(daysAgo(28), ['Pane', 'Sale']),
      run(daysAgo(21), ['Pane']),
      run(daysAgo(14), ['Pane', 'Sale']),
      run(daysAgo(7), ['Pane']),
      run(daysAgo(5), ['Pane', 'Sale']),
      run(daysAgo(1), ['Pane']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Sale')?.preselected).toBe(true);
  });

  it('hides an item whose cadence says it is not due yet', () => {
    const history = [
      run(daysAgo(9), ['Pane', 'Detersivo']),
      run(daysAgo(8), ['Pane']),
      run(daysAgo(7), ['Pane']),
      run(daysAgo(6), ['Pane', 'Detersivo']),
      run(daysAgo(5), ['Pane']),
      run(daysAgo(4), ['Pane']),
      run(daysAgo(1), ['Pane', 'Detersivo']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Detersivo')).toBeUndefined();
  });

  it('preselects by elapsed days when few runs happened since the last purchase', () => {
    // Bought every 3rd run, ~weekly. Only one run since, but 8 days elapsed.
    const history = [
      run(daysAgo(24), ['Pane', 'Uova']),
      run(daysAgo(23), ['Pane']),
      run(daysAgo(22), ['Pane']),
      run(daysAgo(16), ['Pane', 'Uova']),
      run(daysAgo(15), ['Pane']),
      run(daysAgo(14), ['Pane']),
      run(daysAgo(8), ['Pane', 'Uova']),
    ];
    const uova = find(buildSuggestions(history, [], NOW), 'Uova');
    expect(uova?.preselected).toBe(true);
    expect(uova?.intervalDays).toBe(8);
  });

  it('hides an abandoned habit', () => {
    const history = [
      run(daysAgo(70), ['Pane', 'Tofu']),
      run(daysAgo(63), ['Pane', 'Tofu']),
      run(daysAgo(56), ['Pane', 'Tofu']),
      run(daysAgo(49), ['Pane']),
      run(daysAgo(42), ['Pane']),
      run(daysAgo(35), ['Pane']),
      run(daysAgo(28), ['Pane']),
      run(daysAgo(21), ['Pane']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Tofu')).toBeUndefined();
  });

  it('keeps regular items after a long break with no shopping at all', () => {
    const history = [
      run(daysAgo(74), ['Latte']),
      run(daysAgo(67), ['Latte']),
      run(daysAgo(60), ['Latte']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Latte')?.preselected).toBe(true);
  });

  it('ignores items bought only once', () => {
    const history = [run(daysAgo(14), ['Pane']), run(daysAgo(7), ['Pane', 'Zafferano'])];
    expect(find(buildSuggestions(history, [], NOW), 'Zafferano')).toBeUndefined();
  });

  describe('two-purchase frequency fallback', () => {
    it('preselects when present in both of two runs', () => {
      const history = [run(daysAgo(14), ['Pane']), run(daysAgo(7), ['Pane'])];
      const pane = find(buildSuggestions(history, [], NOW), 'Pane');
      expect(pane?.preselected).toBe(true);
      expect(pane?.intervalDays).toBeNull();
    });

    it('shows without preselecting at a middling share of recent runs', () => {
      const history = [
        run(daysAgo(28), ['Pane', 'Riso']),
        run(daysAgo(21), ['Pane']),
        run(daysAgo(14), ['Pane', 'Riso']),
        run(daysAgo(7), ['Pane']),
      ];
      const riso = find(buildSuggestions(history, [], NOW), 'Riso');
      expect(riso).toBeDefined();
      expect(riso?.preselected).toBe(false);
    });

    it('hides when the share of recent runs is low', () => {
      const history = Array.from({ length: SUGGEST_FREQUENCY_WINDOW }, (_, i) =>
        run(daysAgo((SUGGEST_FREQUENCY_WINDOW - i) * 7), i < 2 ? ['Pane', 'Miele'] : ['Pane']),
      );
      expect(find(buildSuggestions(history, [], NOW), 'Miele')).toBeUndefined();
    });
  });

  it('merges runs recorded on the same calendar day', () => {
    const history = [
      run(daysAgo(14), ['Pane']),
      run(daysAgo(7), ['Pane']),
      run(daysAgo(7) + 60_000, ['Pane', 'Burro']),
    ];
    const result = buildSuggestions(history, [], NOW);
    expect(result.runCount).toBe(2);
    expect(find(result, 'Pane')?.purchaseCount).toBe(2);
    expect(find(result, 'Burro')).toBeUndefined();
  });

  it('counts every recorded entry and item, whatever the trigger or checked flag', () => {
    const history = [
      run(daysAgo(14), [{ name: 'Pane', checked: false }], 'empty_fallback'),
      run(daysAgo(7), ['Pane']),
    ];
    const result = buildSuggestions(history, [], NOW);
    expect(result.runCount).toBe(2);
    expect(find(result, 'Pane')?.purchaseCount).toBe(2);
  });

  it('groups names ignoring case and accents', () => {
    const history = [
      run(daysAgo(21), ['caffè']),
      run(daysAgo(14), ['Caffe']),
      run(daysAgo(7), ['CAFFÈ ']),
    ];
    const result = buildSuggestions(history, [], NOW);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.purchaseCount).toBe(3);
  });

  it('takes name, category and quantity from the most recent purchase', () => {
    const history = [
      run(daysAgo(14), [{ name: 'latte', category: 'other', quantity: '1' }]),
      run(daysAgo(7), [{ name: 'Latte', category: 'dairy', quantity: '2' }]),
    ];
    const latte = buildSuggestions(history, [], NOW).suggestions[0];
    expect(latte).toMatchObject({ name: 'Latte', category: 'dairy', quantity: '2' });
  });

  it('excludes items already on the list', () => {
    const history = [run(daysAgo(14), ['Pane', 'Latte']), run(daysAgo(7), ['Pane', 'Latte'])];
    const result = buildSuggestions(history, [{ name: ' pane' }], NOW);
    expect(result.suggestions.map((s) => s.name)).toEqual(['Latte']);
  });

  it('is independent of the input order of history entries', () => {
    const history = [
      run(daysAgo(7), ['Latte']),
      run(daysAgo(21), ['Latte']),
      run(daysAgo(14), ['Latte']),
    ];
    expect(find(buildSuggestions(history, [], NOW), 'Latte')?.intervalDays).toBe(7);
  });

  it('sorts preselected first, then by name', () => {
    const history = [
      run(daysAgo(28), ['Zucchero', 'Aceto', 'Sale']),
      run(daysAgo(21), ['Zucchero', 'Aceto']),
      run(daysAgo(14), ['Zucchero', 'Aceto', 'Sale']),
      run(daysAgo(7), ['Zucchero', 'Aceto']),
      run(daysAgo(1), ['Zucchero', 'Aceto', 'Sale']),
    ];
    const result = buildSuggestions(history, [], NOW);
    expect(result.suggestions.map((s) => s.name)).toEqual(['Aceto', 'Zucchero', 'Sale']);
  });
});
