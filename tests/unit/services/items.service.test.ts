import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchSet = vi.fn();
const batchDelete = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn().mockResolvedValue(undefined);
const writeBatchMock = vi.fn(() => ({
  set: batchSet,
  delete: batchDelete,
  update: batchUpdate,
  commit: batchCommit,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'items' }),
  doc: vi.fn((_col, id) => ({ id })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn(() => ({ __deleteField: true })),
  getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
  getDoc: vi.fn().mockResolvedValue({ data: () => ({}) }),
  getCountFromServer: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  limit: vi.fn().mockReturnValue({ type: 'limit' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
  writeBatch: () => writeBatchMock(),
}));

vi.mock('@/services/catalog.service', () => ({
  upsertCatalogEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/listFavorites.service', () => ({
  upsertListFavorite: vi.fn().mockResolvedValue(undefined),
}));

import {
  countListItems,
  addItem,
  bulkAddItems,
  bulkRemoveItems,
  bulkMoveItems,
  emptyList,
  setItemPriority,
  moveItem
} from '@/services/items.service';
import {
  setDoc,
  updateDoc,
  deleteDoc,
  getCountFromServer,
  where
} from 'firebase/firestore';
import { upsertCatalogEntry } from '@/services/catalog.service';
import { upsertListFavorite } from '@/services/listFavorites.service';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

// Parent-list writes only bump updatedAt: item counts are derived from the
// item docs and never stored on the list, so they cannot drift.
const expectListTouchOnly = (payload: unknown): void => {
  expect(Object.keys(payload as object)).toEqual(['updatedAt']);
  expect(typeof (payload as Record<string, unknown>).updatedAt).toBe('number');
};
const batchUpdatePayloads = (): unknown[] => batchUpdate.mock.calls.map(([, data]) => data);

const listId = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as ULID;
const itemId = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as ULID;

const defaultAddParams = {
  listId,
  name: 'Latte',
  quantity: '1',
  category: 'dairy' as const,
  note: '',
  createdByUid: 'uid-1',
  addedVia: 'autocomplete' as const,
};

const defaultBulkAddParams = {
  listId,
  createdByUid: 'uid-1',
  addedVia: 'bulk' as const,
};

describe('items.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
    vi.mocked(upsertCatalogEntry).mockResolvedValue(undefined);
    vi.mocked(upsertListFavorite).mockResolvedValue(undefined);
    batchSet.mockReset();
    batchDelete.mockReset();
    batchUpdate.mockReset();
    batchCommit.mockReset().mockResolvedValue(undefined);
    writeBatchMock.mockClear();
  });

  describe('addItem', () => {
    it('does not write the item via raw setDoc (atomicity I5)', async () => {
      await addItem(defaultAddParams);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('emptyList', () => {
    const mkIds = (n: number): ULID[] =>
      Array.from({ length: n }, (_, i) => `01ARZ3NDEKTSV4RRFFQ69G5${String(i).padStart(3, '0')}` as ULID);

    it('handles 500 items as two batches (499 + 1) - Firestore 500-op cap leaves no room', async () => {
      const ids = mkIds(500);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      expect(batchCommit).toHaveBeenCalledTimes(2);
    });

    it('handles 1000 items as three batches (499 + 499 + 2)', async () => {
      const ids = mkIds(1000);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(3);
      expect(batchCommit).toHaveBeenCalledTimes(3);
    });
  });

  describe('bulkAddItems (I5-style atomic batching)', () => {
    const mkRows = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        name: `Item ${i}`,
        category: 'other' as const,
      }));

    it('splits exactly at the 499-row boundary into two batches', async () => {
      await bulkAddItems({
        ...defaultBulkAddParams,
        rows: mkRows(500),
      });
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchSet).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      batchUpdatePayloads().forEach(expectListTouchOnly);
    });

    it('swallows catalog/favorite errors so item writes remain authoritative', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(upsertCatalogEntry).mockRejectedValueOnce(new Error('quota'));
      vi.mocked(upsertListFavorite).mockRejectedValueOnce(new Error('quota'));
      await expect(
        bulkAddItems({
          ...defaultBulkAddParams,
          rows: [{ name: 'Mela', category: 'fruit_vegetables' }],
        }),
      ).resolves.toBeDefined();
      warn.mockRestore();
    });
  });

  describe('bulkRemoveItems (S3.2)', () => {
    it('chunks at 499 deletes per batch with the list update in the same batch', async () => {
      const ids = Array.from({ length: 500 }, (_, i) => `01ARZ3NDEKTSV4RRFFQ69G5${String(i).padStart(3, '0')}`) as ULID[];
      await bulkRemoveItems(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      batchUpdatePayloads().forEach(expectListTouchOnly);
    });
  });

  describe('bulkMoveItems (S3.2)', () => {
    const src = '01SRCLIST' as ULID;
    const dst = '01DSTLIST' as ULID;
    const sample = (id: string): Item => ({
      id: id as ULID,
      listId: src,
      name: 'X',
      quantity: '',
      category: 'other',
      note: '',
      checked: false,
      createdByUid: 'uid-1',
      createdAt: 1,
      updatedAt: 1,
    });

    it('per batch: N set + N delete + 2 list updates (src - / dst +)', async () => {
      const items = [sample('01A'), sample('01B'), sample('01C')];
      await bulkMoveItems(src, items, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledTimes(3);
      expect(batchDelete).toHaveBeenCalledTimes(3);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      batchUpdatePayloads().forEach(expectListTouchOnly);
    });

    it('chunks at 249 items per batch to respect the 500-op cap', async () => {
      const items = Array.from({ length: 250 }, (_, i) => sample(`01${String(i).padStart(4, '0')}`));
      await bulkMoveItems(src, items, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('countListItems', () => {
    it('counts all items and urgent ones with two count() aggregations', async () => {
      vi.mocked(getCountFromServer)
        .mockResolvedValueOnce({ data: () => ({ count: 9 }) } as never)
        .mockResolvedValueOnce({ data: () => ({ count: 2 }) } as never);
      await expect(countListItems(listId)).resolves.toEqual({ itemCount: 9, urgentCount: 2 });
      expect(getCountFromServer).toHaveBeenCalledTimes(2);
      expect(where).toHaveBeenCalledWith('priority', '==', 'urgent');
    });
  });

  describe('setItemPriority', () => {
    it('uses deleteField marker when clearing priority (null)', async () => {
      await setItemPriority(listId, itemId, null);
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(payload.priority).toEqual({ __deleteField: true });
    });
  });

  const sampleItem: Item = {
    id: itemId,
    listId,
    name: 'Latte',
    quantity: '1L',
    category: 'dairy',
    note: '',
    checked: false,
    createdByUid: 'uid-1',
    createdAt: 1000,
    updatedAt: 1000,
  };

  describe('moveItem', () => {
    it('writes destination and deletes source in a single batch', async () => {
      const dst = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;
      await moveItem(listId, sampleItem, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
    });
  });
});
