import { describe, it, expect, vi } from 'vitest';
// main() is guarded behind a direct-execution check, so importing is
// side-effect-free (no Firebase init, no prompt).
import {
  COUNTER_FIELDS,
  listsWithCounters,
  dropListCounters,
} from '../../../scripts/drop-list-counters.mjs';

const snap = (id: string, data: Record<string, unknown>) => ({
  id,
  ref: { id, path: `lists/${id}` },
  data: () => data,
});

const DELETE = { __delete: true };

/** Minimal admin-Firestore stand-in: one collection read, batched updates. */
const fakeDb = (docs: ReturnType<typeof snap>[]) => {
  const batches: Array<Array<{ ref: { id: string }; patch: Record<string, unknown> }>> = [];
  const db = {
    collection: vi.fn(() => ({
      get: vi.fn(async () => ({ docs, size: docs.length })),
    })),
    batch: vi.fn(() => {
      const ops: Array<{ ref: { id: string }; patch: Record<string, unknown> }> = [];
      batches.push(ops);
      return {
        update: vi.fn((ref: { id: string }, patch: Record<string, unknown>) => ops.push({ ref, patch })),
        commit: vi.fn(async () => undefined),
      };
    }),
  };
  return { db, batches };
};

describe('drop-list-counters listsWithCounters', () => {
  it('targets exactly the legacy itemCount / urgentCount fields', () => {
    expect(COUNTER_FIELDS).toEqual(['itemCount', 'urgentCount']);
  });

  it('returns only the lists holding a counter, with the fields they hold', () => {
    const result = listsWithCounters([
      snap('L1', { name: 'Spesa', itemCount: 5, urgentCount: 0 }),
      snap('L2', { name: 'Casa' }),
      snap('L3', { name: 'Ufficio', urgentCount: 2 }),
    ]);
    expect(result.map((r: { id: string; fields: string[] }) => [r.id, r.fields])).toEqual([
      ['L1', ['itemCount', 'urgentCount']],
      ['L3', ['urgentCount']],
    ]);
  });

  it('counts a zero or negative counter as present (it still has to go)', () => {
    const result = listsWithCounters([snap('L1', { itemCount: 0 }), snap('L2', { itemCount: -1 })]);
    expect(result).toHaveLength(2);
  });
});

describe('drop-list-counters dropListCounters', () => {
  it('dry run reads and reports, but never writes', async () => {
    const { db, batches } = fakeDb([snap('L1', { itemCount: 5 }), snap('L2', {})]);
    const report = await dropListCounters(db, { apply: false, deleteField: () => DELETE });
    expect(report).toEqual({ scanned: 2, withCounters: 1, updated: 0 });
    expect(db.batch).not.toHaveBeenCalled();
    expect(batches).toHaveLength(0);
  });

  it('apply deletes only the fields each list holds', async () => {
    const { db, batches } = fakeDb([
      snap('L1', { itemCount: 5, urgentCount: 1 }),
      snap('L2', {}),
      snap('L3', { urgentCount: 2 }),
    ]);
    const report = await dropListCounters(db, { apply: true, deleteField: () => DELETE });
    expect(report).toEqual({ scanned: 3, withCounters: 2, updated: 2 });
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((op) => [op.ref.id, op.patch])).toEqual([
      ['L1', { itemCount: DELETE, urgentCount: DELETE }],
      ['L3', { urgentCount: DELETE }],
    ]);
  });

  it('splits writes into batches of at most 500', async () => {
    const docs = Array.from({ length: 1001 }, (_, i) => snap(`L${i}`, { itemCount: i }));
    const { db, batches } = fakeDb(docs);
    const report = await dropListCounters(db, { apply: true, deleteField: () => DELETE });
    expect(report.updated).toBe(1001);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 1]);
  });

  it('is a no-op when no list holds a counter', async () => {
    const { db } = fakeDb([snap('L1', { name: 'Spesa' })]);
    const report = await dropListCounters(db, { apply: true, deleteField: () => DELETE });
    expect(report).toEqual({ scanned: 1, withCounters: 0, updated: 0 });
    expect(db.batch).not.toHaveBeenCalled();
  });
});
