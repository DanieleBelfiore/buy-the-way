import { migrateCategory } from '@/domain/categories';
import { normalizeName } from '@/domain/public-catalog';
import type { Category, Item, ListHistoryEntry } from '@/domain/types';

/** Below this many distinct shopping runs there is no pattern to read. */
export const SUGGEST_MIN_RUNS = 2;
/** Purchases needed before a repurchase cadence is trusted. */
export const SUGGEST_MIN_PURCHASES_FOR_CADENCE = 3;
/** Cadence score at or above which an item is proposed already ticked. */
export const SUGGEST_PRESELECT_SCORE = 0.8;
/** Cadence score at or above which an item is at least listed. */
export const SUGGEST_SHOW_SCORE = 0.5;
/** Runs skipped, in multiples of the usual cadence, before a habit counts as dropped. */
export const SUGGEST_ABANDONED_SCORE = 4;
/** Recent runs inspected by the frequency fallback (items with too few purchases). */
export const SUGGEST_FREQUENCY_WINDOW = 8;
export const SUGGEST_FREQUENCY_PRESELECT_SHARE = 0.6;
export const SUGGEST_FREQUENCY_SHOW_SHARE = 0.3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Suggestion {
  /** Normalized name: stable identity across runs. */
  key: string;
  name: string;
  category: Category;
  quantity: string;
  purchaseCount: number;
  /** Typical days between purchases; null when there is too little data. */
  intervalDays: number | null;
  preselected: boolean;
}

export type SuggestStatus = 'loading' | 'ready' | 'error';

export interface SuggestionResult {
  /** Distinct shopping runs found in the history (same-day entries merged). */
  runCount: number;
  suggestions: Suggestion[];
}

interface Run {
  at: number;
  items: Item[];
}

interface Tally {
  runIndexes: number[];
  latest: Item;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

const gaps = (values: readonly number[]): number[] =>
  values.slice(1).map((v, i) => v - (values[i] as number));

const localDayKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Collapse history entries into shopping runs, oldest first. Entries from the
 * same calendar day are one run: a second tab or a second collaborator can
 * record the same shop twice, and un-ticking then re-ticking an item records
 * it again.
 */
const toRuns = (history: readonly ListHistoryEntry[]): Run[] => {
  const byDay = new Map<string, Run>();
  for (const entry of history) {
    const key = localDayKey(entry.completedAt);
    const existing = byDay.get(key);
    if (existing) {
      existing.at = Math.max(existing.at, entry.completedAt);
      existing.items.push(...entry.items);
    } else {
      byDay.set(key, { at: entry.completedAt, items: [...entry.items] });
    }
  }
  return [...byDay.values()].sort((a, b) => a.at - b.at);
};

const tallyByName = (runs: readonly Run[]): Map<string, Tally> => {
  const tallies = new Map<string, Tally>();
  runs.forEach((run, index) => {
    for (const item of run.items) {
      const key = normalizeName(item.name);
      if (!key) continue;
      const tally = tallies.get(key);
      if (!tally) {
        tallies.set(key, { runIndexes: [index], latest: item });
      } else {
        if (tally.runIndexes[tally.runIndexes.length - 1] !== index) {
          tally.runIndexes.push(index);
        }
        tally.latest = item;
      }
    }
  });
  return tallies;
};

/** Returns whether to preselect, or null when the item should not be listed. */
const judgeByCadence = (
  runIndexes: readonly number[],
  runs: readonly Run[],
  now: number,
): { preselected: boolean; intervalDays: number } | null => {
  const lastIndex = runIndexes[runIndexes.length - 1] as number;
  // The shop being planned counts as one run since the last purchase.
  const runsSince = runs.length - lastIndex;
  const runScore = runsSince / median(gaps(runIndexes));
  if (runScore > SUGGEST_ABANDONED_SCORE) return null;

  const times = runIndexes.map((i) => (runs[i] as Run).at);
  const medianDays = median(gaps(times)) / DAY_MS;
  const dayScore = (now - (times[times.length - 1] as number)) / DAY_MS / medianDays;

  const score = Math.max(runScore, dayScore);
  if (score < SUGGEST_SHOW_SCORE) return null;
  return {
    preselected: score >= SUGGEST_PRESELECT_SCORE,
    intervalDays: Math.round(medianDays),
  };
};

const judgeByFrequency = (
  runIndexes: readonly number[],
  runCount: number,
): { preselected: boolean } | null => {
  const window = Math.min(runCount, SUGGEST_FREQUENCY_WINDOW);
  const firstInWindow = runCount - window;
  const share = runIndexes.filter((i) => i >= firstInWindow).length / window;
  if (share < SUGGEST_FREQUENCY_SHOW_SHARE) return null;
  return { preselected: share >= SUGGEST_FREQUENCY_PRESELECT_SHARE };
};

/**
 * Propose items for the next shop from past shopping runs. Every recorded
 * history entry counts as a run and every item in it as bought, mirroring
 * what the app records today.
 */
export const buildSuggestions = (
  history: readonly ListHistoryEntry[],
  currentItems: readonly Pick<Item, 'name'>[],
  now: number,
): SuggestionResult => {
  const runs = toRuns(history);
  if (runs.length < SUGGEST_MIN_RUNS) return { runCount: runs.length, suggestions: [] };

  const onList = new Set(currentItems.map((i) => normalizeName(i.name)));
  const suggestions: Suggestion[] = [];

  for (const [key, { runIndexes, latest }] of tallyByName(runs)) {
    if (onList.has(key) || runIndexes.length < 2) continue;

    const hasCadence = runIndexes.length >= SUGGEST_MIN_PURCHASES_FOR_CADENCE;
    const byCadence = hasCadence ? judgeByCadence(runIndexes, runs, now) : null;
    const verdict = hasCadence ? byCadence : judgeByFrequency(runIndexes, runs.length);
    if (!verdict) continue;

    suggestions.push({
      key,
      name: latest.name.trim(),
      category: migrateCategory(latest.category),
      quantity: latest.quantity,
      purchaseCount: runIndexes.length,
      intervalDays: byCadence?.intervalDays ?? null,
      preselected: verdict.preselected,
    });
  }

  suggestions.sort(
    (a, b) => Number(b.preselected) - Number(a.preselected) || a.name.localeCompare(b.name),
  );
  return { runCount: runs.length, suggestions };
};
