import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocsMock = vi.fn();
const setDocMock = vi.fn();
const writeBatchMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'history' }),
  doc: vi.fn((...args: unknown[]) => ({ id: args[args.length - 1] })),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  limit: vi.fn((n: number) => ({ __limit: n })),
  increment: vi.fn((n: number) => ({ __inc: n })),
  writeBatch: () => writeBatchMock(),
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: 'db' },
}));

vi.mock('@/domain/id', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/id')>();
  return {
    ...actual,
    newId: vi.fn(() => '01HIST00000000000000000001' as const),
  };
});

import {
  recordListHistory,
  fetchListHistory,
  pruneListHistory,
  deleteAllListHistory,
} from '@/services/history.service';
import type { ULID } from '@/domain/id';
import type { Item } from '@/domain/types';

const LIST_ID = '01LIST00000000000000000001' as ULID;
const UID = 'user-1';

const sampleItem = (): Item => ({
  id: '01ITEM000000000000000000001' as ULID,
  listId: LIST_ID,
  name: 'Milk',
  quantity: '2',
  note: 'cold',
  category: 'dairy',
  checked: true,
  priority: 'urgent',
  createdByUid: UID,
  createdAt: 100,
  updatedAt: 200,
});

describe('history.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDocMock.mockResolvedValue(undefined);
    getDocsMock.mockResolvedValue({ docs: [] });
    writeBatchMock.mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe('recordListHistory', () => {
    it('writes a full-item snapshot and returns the new id', async () => {
      const id = await recordListHistory(LIST_ID, [sampleItem()], UID, 'completion');
      expect(id).toBe('01HIST00000000000000000001');
      // Two writes on completion: the history snapshot, then the per-user tally.
      expect(setDocMock).toHaveBeenCalledTimes(2);
      const [, data] = setDocMock.mock.calls[0];
      expect(data).toMatchObject({
        id: '01HIST00000000000000000001',
        listId: LIST_ID,
        itemCount: 1,
        recordedByUid: UID,
        trigger: 'completion',
        items: [expect.objectContaining({ name: 'Milk', quantity: '2', note: 'cold' })],
      });
      expect(typeof (data as { completedAt: number }).completedAt).toBe('number');
    });

    it('returns null without writing when items is empty', async () => {
      const id = await recordListHistory(LIST_ID, [], UID, 'empty_fallback');
      expect(id).toBeNull();
      expect(setDocMock).not.toHaveBeenCalled();
    });

    it('bumps the per-user completed-shop tally on completion', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      await recordListHistory(LIST_ID, [sampleItem()], UID, 'completion');
      const counterCall = setDocMock.mock.calls.find(
        ([ref]) => (ref as { id: string }).id === 'state',
      );
      expect(counterCall).toBeDefined();
      const [, data, opts] = counterCall!;
      expect(data).toEqual({
        completedShopCount: { __inc: 1 },
        lastCompletedShopAt: now,
      });
      expect(opts).toEqual({ merge: true });
    });

    it('does not touch the per-user tally on empty_fallback', async () => {
      await recordListHistory(LIST_ID, [sampleItem()], UID, 'empty_fallback');
      const counterCall = setDocMock.mock.calls.find(
        ([ref]) => (ref as { id: string }).id === 'state',
      );
      expect(counterCall).toBeUndefined();
      expect(setDocMock).toHaveBeenCalledOnce();
    });

    it('still returns the id (and warns) when the tally write fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // History write resolves; the follow-up counter write rejects.
      setDocMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(
        new Error('boom'),
      );
      const id = await recordListHistory(LIST_ID, [sampleItem()], UID, 'completion');
      expect(id).toBe('01HIST00000000000000000001');
      expect(warn).toHaveBeenCalledWith(
        '[history] Failed to bump completedShopCount:',
        expect.any(Error),
      );
      warn.mockRestore();
    });

    it('prunes after insert when over the cap', async () => {
      const excess = Array.from({ length: 51 }, (_, i) => ({
        ref: { id: `h${i}` },
        data: () => ({ completedAt: i }),
      }));
      getDocsMock.mockResolvedValue({ docs: excess });
      await recordListHistory(LIST_ID, [sampleItem()], UID, 'completion');
      expect(writeBatchMock).toHaveBeenCalled();
    });
  });

  describe('fetchListHistory', () => {
    it('returns entries newest-first mapped from Firestore docs', async () => {
      getDocsMock.mockResolvedValue({
        docs: [
          {
            id: 'H2',
            data: () => ({
              id: 'H2',
              listId: LIST_ID,
              completedAt: 200,
              itemCount: 1,
              recordedByUid: UID,
              trigger: 'completion',
              items: [sampleItem()],
            }),
          },
          {
            id: 'H1',
            data: () => ({
              id: 'H1',
              listId: LIST_ID,
              completedAt: 100,
              itemCount: 1,
              recordedByUid: UID,
              trigger: 'empty_fallback',
              items: [sampleItem()],
            }),
          },
        ],
      });

      const entries = await fetchListHistory(LIST_ID);

      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('H2');
      expect(entries[1].trigger).toBe('empty_fallback');
    });

    it('clamps the requested limit to HISTORY_MAX_ENTRIES', async () => {
      const { HISTORY_MAX_ENTRIES } = await import('@/domain/history');
      const { limit } = await import('firebase/firestore');

      getDocsMock.mockResolvedValue({ docs: [] });
      await fetchListHistory(LIST_ID, { limit: 999 });

      expect(limit).toHaveBeenCalledWith(HISTORY_MAX_ENTRIES);
    });

    it('defaults to HISTORY_MAX_ENTRIES when limit is omitted', async () => {
      const { HISTORY_MAX_ENTRIES } = await import('@/domain/history');
      const { limit } = await import('firebase/firestore');

      getDocsMock.mockResolvedValue({ docs: [] });
      await fetchListHistory(LIST_ID);

      expect(limit).toHaveBeenCalledWith(HISTORY_MAX_ENTRIES);
    });
  });

  describe('pruneListHistory', () => {
    it('does nothing when at or under the cap', async () => {
      getDocsMock.mockResolvedValue({
        docs: [{ ref: { id: 'h1' } }, { ref: { id: 'h2' } }],
      });
      await pruneListHistory(LIST_ID);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('deletes entries beyond the newest 50', async () => {
      const batchDelete = vi.fn();
      writeBatchMock.mockReturnValue({
        delete: batchDelete,
        commit: vi.fn().mockResolvedValue(undefined),
      });
      const docs = Array.from({ length: 52 }, (_, i) => ({ ref: { id: `h${i}` } }));
      getDocsMock.mockResolvedValue({ docs });
      await pruneListHistory(LIST_ID);
      expect(batchDelete).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteAllListHistory', () => {
    it('batch-deletes every history doc for the list', async () => {
      const batchDelete = vi.fn();
      writeBatchMock.mockReturnValue({
        delete: batchDelete,
        commit: vi.fn().mockResolvedValue(undefined),
      });
      getDocsMock.mockResolvedValue({
        docs: [{ ref: { id: 'h1' } }, { ref: { id: 'h2' } }],
      });
      await deleteAllListHistory(LIST_ID);
      expect(batchDelete).toHaveBeenCalledTimes(2);
    });

    it('no-ops when history is empty', async () => {
      getDocsMock.mockResolvedValue({ docs: [] });
      await deleteAllListHistory(LIST_ID);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });
  });
});
