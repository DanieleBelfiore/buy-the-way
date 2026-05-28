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
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  limit: vi.fn().mockReturnValue({ type: 'limit' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
  writeBatch: (...args: unknown[]) => writeBatchMock(...args),
  increment: vi.fn((n: number) => ({ __increment: n })),
}));

vi.mock('@/services/catalog.service', () => ({
  upsertCatalogEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/listFavorites.service', () => ({
  upsertListFavorite: vi.fn().mockResolvedValue(undefined),
}));

import {
  subscribeItems,
  addItem,
  bulkAddItems,
  bulkRemoveItems,
  bulkCopyItems,
  bulkMoveItems,
  toggleChecked,
  removeItem,
  emptyList,
  updateItem,
  setItemPriority,
  copyItem,
  moveItem,
} from '@/services/items.service';
import { setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { upsertCatalogEntry } from '@/services/catalog.service';
import { upsertListFavorite } from '@/services/listFavorites.service';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

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
    it('writes item doc via batch.set (atomic with itemCount bump)', async () => {
      await addItem(defaultAddParams);
      expect(batchSet).toHaveBeenCalledOnce();
    });

    it('includes all required Item fields in doc', async () => {
      await addItem(defaultAddParams);
      const [, data] = batchSet.mock.calls[0];
      expect(data).toMatchObject({
        listId,
        name: 'Latte',
        quantity: '1',
        category: 'dairy',
        note: '',
        checked: false,
        createdByUid: 'uid-1',
        addedVia: 'autocomplete',
      });
      expect(typeof (data as any).createdAt).toBe('number');
      expect(typeof (data as any).updatedAt).toBe('number');
    });

    it('returns a 26-char ULID', async () => {
      const id = await addItem(defaultAddParams);
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(26);
    });

    it('id in doc matches returned id', async () => {
      const id = await addItem(defaultAddParams);
      const [, data] = batchSet.mock.calls[0];
      expect((data as any).id).toBe(id);
    });

    it('calls upsertCatalogEntry with correct args', async () => {
      await addItem(defaultAddParams);
      expect(upsertCatalogEntry).toHaveBeenCalledOnce();
      expect(upsertCatalogEntry).toHaveBeenCalledWith('uid-1', 'Latte', 'dairy');
    });

    it('also calls upsertListFavorite (per-list favorite state) with listId + capitalized name', async () => {
      await addItem(defaultAddParams);
      expect(upsertListFavorite).toHaveBeenCalledOnce();
      expect(upsertListFavorite).toHaveBeenCalledWith(listId, 'Latte', 'dairy');
    });

    it('checked defaults to false', async () => {
      await addItem(defaultAddParams);
      const [, data] = batchSet.mock.calls[0];
      expect((data as any).checked).toBe(false);
    });

    it('does not write the item via raw setDoc (atomicity I5)', async () => {
      await addItem(defaultAddParams);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('persists addedVia on the item doc', async () => {
      await addItem({ ...defaultAddParams, addedVia: 'favorite' });
      const [, data] = batchSet.mock.calls[0];
      expect((data as { addedVia: string }).addedVia).toBe('favorite');
    });
  });

  describe('toggleChecked', () => {
    it('calls updateDoc twice (item + parent list updatedAt)', async () => {
      await toggleChecked(listId, itemId, true);
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('patches only checked + updatedAt on the item', async () => {
      await toggleChecked(listId, itemId, true);
      const [, data] = vi.mocked(updateDoc).mock.calls[0];
      expect(data).toMatchObject({ checked: true });
      expect(Object.keys(data as object)).toHaveLength(2);
      expect(Object.keys(data as object)).toContain('updatedAt');
    });

    it('bumps parent list updatedAt only', async () => {
      await toggleChecked(listId, itemId, true);
      const [, listPayload] = vi.mocked(updateDoc).mock.calls[1]!;
      expect(Object.keys(listPayload as object)).toEqual(['updatedAt']);
      expect(typeof (listPayload as { updatedAt: unknown }).updatedAt).toBe('number');
    });

    it('patches checked = false correctly', async () => {
      await toggleChecked(listId, itemId, false);
      const [, data] = vi.mocked(updateDoc).mock.calls[0];
      expect((data as any).checked).toBe(false);
    });

    it('does not call setDoc', async () => {
      await toggleChecked(listId, itemId, true);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('calls deleteDoc', async () => {
      await removeItem(listId, itemId);
      expect(deleteDoc).toHaveBeenCalledOnce();
    });

    it('does not call setDoc', async () => {
      await removeItem(listId, itemId);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('decrements list itemCount via updateDoc', async () => {
      await removeItem(listId, itemId);
      expect(updateDoc).toHaveBeenCalledOnce();
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.itemCount).toEqual({ __increment: -1 });
      expect(typeof payload.updatedAt).toBe('number');
    });
  });

  describe('addItem itemCount bump', () => {
    it('increments list itemCount via batch.update on add (same batch as item write - I5)', async () => {
      await addItem(defaultAddParams);
      expect(batchUpdate).toHaveBeenCalled();
      const payloads = batchUpdate.mock.calls.map(([, data]) => data as Record<string, unknown>);
      expect(payloads.some((p) => JSON.stringify(p.itemCount) === JSON.stringify({ __increment: 1 }))).toBe(true);
    });
  });

  describe('updateItem', () => {
    it('calls updateDoc twice (item patch + parent list updatedAt)', async () => {
      await updateItem(listId, itemId, { name: 'Latte fresco', quantity: '2L' });
      expect(updateDoc).toHaveBeenCalledTimes(2);
      const call = vi.mocked(updateDoc).mock.calls[0]!;
      const payload = call[1] as Record<string, unknown>;
      expect(payload.name).toBe('Latte fresco');
      expect(payload.quantity).toBe('2L');
      expect(typeof payload.updatedAt).toBe('number');
      const listPayload = vi.mocked(updateDoc).mock.calls[1]![1] as Record<string, unknown>;
      expect(Object.keys(listPayload)).toEqual(['updatedAt']);
    });

    it('accepts partial patches (note only)', async () => {
      await updateItem(listId, itemId, { note: 'Biologico' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.note).toBe('Biologico');
      expect(payload.name).toBeUndefined();
    });

    it('accepts category patch', async () => {
      await updateItem(listId, itemId, { category: 'bakery' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.category).toBe('bakery');
    });

    it('capitalizes lowercase initial of name patch', async () => {
      await updateItem(listId, itemId, { name: 'pane integrale' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.name).toBe('Pane integrale');
    });

    it('leaves already-capitalized name unchanged', async () => {
      await updateItem(listId, itemId, { name: 'Pane' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.name).toBe('Pane');
    });

    it('does not include name field when patch omits it', async () => {
      await updateItem(listId, itemId, { note: 'x' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.name).toBeUndefined();
    });

    it('capitalizes lowercase initial of note patch', async () => {
      await updateItem(listId, itemId, { note: 'biologico' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.note).toBe('Biologico');
    });

    it('leaves already-capitalized note unchanged', async () => {
      await updateItem(listId, itemId, { note: 'Manitoba' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.note).toBe('Manitoba');
    });

    it('trims trailing/leading whitespace from name patch', async () => {
      await updateItem(listId, itemId, { name: '  Pane integrale  ' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.name).toBe('Pane integrale');
    });

    it('trims trailing/leading whitespace from note patch', async () => {
      await updateItem(listId, itemId, { note: '  biologico  ' });
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.note).toBe('Biologico');
    });
  });

  describe('addItem capitalization', () => {
    it('capitalizes lowercase initial of new item name', async () => {
      await addItem({ ...defaultAddParams, name: 'mela rossa' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { name: string }).name).toBe('Mela rossa');
    });

    it('forwards capitalized name to upsertCatalogEntry', async () => {
      await addItem({ ...defaultAddParams, name: 'mela' });
      const args = vi.mocked(upsertCatalogEntry).mock.calls[0]!;
      expect(args[1]).toBe('Mela');
    });

    it('leaves already-capitalized name unchanged', async () => {
      await addItem({ ...defaultAddParams, name: 'Pane' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { name: string }).name).toBe('Pane');
    });

    it('capitalizes lowercase initial of note', async () => {
      await addItem({ ...defaultAddParams, note: 'semola' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { note: string }).note).toBe('Semola');
    });

    it('leaves already-capitalized note unchanged', async () => {
      await addItem({ ...defaultAddParams, note: 'Manitoba' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { note: string }).note).toBe('Manitoba');
    });

    it('keeps empty note empty', async () => {
      await addItem({ ...defaultAddParams, note: '' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { note: string }).note).toBe('');
    });

    it('trims trailing/leading whitespace from name', async () => {
      await addItem({ ...defaultAddParams, name: '  Mela rossa   ' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { name: string }).name).toBe('Mela rossa');
    });

    it('trims trailing/leading whitespace from note', async () => {
      await addItem({ ...defaultAddParams, note: '   semola  ' });
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { note: string }).note).toBe('Semola');
    });

    it('forwards trimmed name to upsertCatalogEntry', async () => {
      await addItem({ ...defaultAddParams, name: '  Mela  ' });
      const args = vi.mocked(upsertCatalogEntry).mock.calls[0]!;
      expect(args[1]).toBe('Mela');
    });
  });

  describe('emptyList', () => {
    const mkIds = (n: number): ULID[] =>
      Array.from({ length: n }, (_, i) => `01ARZ3NDEKTSV4RRFFQ69G5${String(i).padStart(3, '0')}` as ULID);

    it('does nothing when itemIds is empty', async () => {
      await emptyList(listId, []);
      expect(writeBatchMock).not.toHaveBeenCalled();
      expect(batchCommit).not.toHaveBeenCalled();
    });

    it('uses a single batch for <= 499 items (chunk size leaves room for the itemCount update)', async () => {
      const ids = mkIds(3);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledTimes(3);
      // I6: itemCount update slotted into the SAME batch as the deletes.
      expect(batchUpdate).toHaveBeenCalledOnce();
      const [, payload] = batchUpdate.mock.calls[0]!;
      expect((payload as any).itemCount).toEqual({ __increment: -3 });
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('handles exactly 499 items in a single batch', async () => {
      const ids = mkIds(499);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledTimes(499);
      expect(batchUpdate).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('handles 500 items as two batches (499 + 1) - Firestore 500-op cap leaves no room', async () => {
      const ids = mkIds(500);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      expect(batchCommit).toHaveBeenCalledTimes(2);
    });

    it('paginates into 499-item chunks for > 499 items', async () => {
      const ids = mkIds(600);
      await emptyList(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledTimes(600);
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

    it('no-ops on empty input (no firestore writes)', async () => {
      const ids = await bulkAddItems({ ...defaultBulkAddParams, rows: [] });
      expect(ids).toEqual([]);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('puts every item AND the itemCount bump into a single batch for ≤499 rows', async () => {
      const ids = await bulkAddItems({
        ...defaultBulkAddParams,
        rows: mkRows(3),
      });
      expect(ids).toHaveLength(3);
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledTimes(3);
      expect(batchUpdate).toHaveBeenCalledOnce();
      const [, payload] = batchUpdate.mock.calls[0]!;
      expect((payload as any).itemCount).toEqual({ __increment: 3 });
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('splits exactly at the 499-row boundary into two batches', async () => {
      await bulkAddItems({
        ...defaultBulkAddParams,
        rows: mkRows(500),
      });
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchSet).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      // First batch increments by 499, second by 1.
      const increments = batchUpdate.mock.calls.map((c) => (c[1] as any).itemCount);
      expect(increments).toEqual(
        expect.arrayContaining([{ __increment: 499 }, { __increment: 1 }]),
      );
    });

    it('capitalises names + notes', async () => {
      await bulkAddItems({
        ...defaultBulkAddParams,
        rows: [
          { name: 'pane', category: 'bakery', note: 'biologico' },
          { name: 'Latte', category: 'dairy', note: 'Manitoba' },
        ],
      });
      const writes = batchSet.mock.calls.map((c) => c[1] as any);
      expect(writes[0].name).toBe('Pane');
      expect(writes[0].note).toBe('Biologico');
      expect(writes[1].name).toBe('Latte');
      expect(writes[1].note).toBe('Manitoba');
    });

    it('forwards each row to catalog + favorite upserts after commit (best-effort)', async () => {
      await bulkAddItems({
        ...defaultBulkAddParams,
        rows: [
          { name: 'mela', category: 'fruit_vegetables' },
          { name: 'pane', category: 'bakery' },
        ],
      });
      expect(upsertCatalogEntry).toHaveBeenCalledTimes(2);
      expect(upsertCatalogEntry).toHaveBeenCalledWith('uid-1', 'Mela', 'fruit_vegetables');
      expect(upsertCatalogEntry).toHaveBeenCalledWith('uid-1', 'Pane', 'bakery');
      expect(upsertListFavorite).toHaveBeenCalledTimes(2);
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
    it('no-ops on empty input', async () => {
      await bulkRemoveItems(listId, []);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('chunks at 499 deletes per batch and decrements itemCount in same batch', async () => {
      const ids = Array.from({ length: 500 }, (_, i) => `01ARZ3NDEKTSV4RRFFQ69G5${String(i).padStart(3, '0')}`) as ULID[];
      await bulkRemoveItems(listId, ids);
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledTimes(500);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      const increments = batchUpdate.mock.calls.map((c) => (c[1] as any).itemCount);
      expect(increments).toEqual(
        expect.arrayContaining([{ __increment: -499 }, { __increment: -1 }]),
      );
    });
  });

  describe('bulkCopyItems (S3.2)', () => {
    const baseItem: Item = {
      id: '01SRC1' as ULID,
      listId,
      name: 'Latte',
      quantity: '1L',
      category: 'dairy',
      note: '',
      checked: false,
      createdByUid: 'uid-1',
      createdAt: 1,
      updatedAt: 1,
    };

    it('no-ops on empty input', async () => {
      const ids = await bulkCopyItems([], '01DST' as ULID, 'uid-1');
      expect(ids).toEqual([]);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('writes one item per row + a single dst itemCount bump per batch', async () => {
      const items: Item[] = [baseItem, { ...baseItem, id: '01SRC2' as ULID, name: 'Pane', category: 'bakery' }];
      const ids = await bulkCopyItems(items, '01DST' as ULID, 'uid-1');
      expect(ids).toHaveLength(2);
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledTimes(2);
      expect(batchUpdate).toHaveBeenCalledOnce();
      const [, payload] = batchUpdate.mock.calls[0]!;
      expect((payload as any).itemCount).toEqual({ __increment: 2 });
    });

    it('forwards every copied row to catalog + favorite upserts (best-effort)', async () => {
      await bulkCopyItems([baseItem], '01DST' as ULID, 'uid-1');
      expect(upsertCatalogEntry).toHaveBeenCalledWith('uid-1', 'Latte', 'dairy');
      expect(upsertListFavorite).toHaveBeenCalledWith('01DST', 'Latte', 'dairy');
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

    it('no-ops on empty input', async () => {
      const ids = await bulkMoveItems(src, [], dst, 'uid-1');
      expect(ids).toEqual([]);
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('per batch: N set + N delete + 2 list updates (src - / dst +)', async () => {
      const items = [sample('01A'), sample('01B'), sample('01C')];
      await bulkMoveItems(src, items, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledTimes(3);
      expect(batchDelete).toHaveBeenCalledTimes(3);
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      const increments = batchUpdate.mock.calls.map((c) => (c[1] as any).itemCount);
      expect(increments).toEqual(
        expect.arrayContaining([{ __increment: 3 }, { __increment: -3 }]),
      );
    });

    it('chunks at 249 items per batch to respect the 500-op cap', async () => {
      const items = Array.from({ length: 250 }, (_, i) => sample(`01${String(i).padStart(4, '0')}`));
      await bulkMoveItems(src, items, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeItems', () => {
    it('returns an unsubscribe function', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      const unsub = subscribeItems(listId, vi.fn(), vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('calls onSnapshot once', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      subscribeItems(listId, vi.fn(), vi.fn());
      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('maps snapshot docs to Item objects and calls onChange', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any, _onError: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });

      const onChange = vi.fn();
      subscribeItems(listId, onChange, vi.fn());

      capturedNext!({
        docs: [
          {
            id: itemId,
            data: () => ({
              listId,
              name: 'Latte',
              quantity: '1',
              category: 'dairy',
              note: '',
              checked: false,
              createdByUid: 'uid-1',
              createdAt: 1000,
              updatedAt: 1000,
            }),
          },
        ],
      });

      expect(onChange).toHaveBeenCalledOnce();
      const items = onChange.mock.calls[0][0];
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: itemId, name: 'Latte', checked: false });
    });

    it('calls onError on snapshot error', () => {
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(new Error('permission-denied'));
        return vi.fn() as any;
      });

      const onError = vi.fn();
      subscribeItems(listId, vi.fn(), onError);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('setItemPriority', () => {
    it('calls updateDoc with the priority value', async () => {
      await setItemPriority(listId, itemId, 'urgent');
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
      expect(payload.priority).toBe('urgent');
    });

    it('uses deleteField marker when clearing priority (null)', async () => {
      await setItemPriority(listId, itemId, null);
      const payload = vi.mocked(updateDoc).mock.calls[0]![1] as Record<string, unknown>;
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

  describe('copyItem', () => {
    it('writes a new item in the destination list via batch', async () => {
      const dst = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;
      await copyItem(sampleItem, dst, 'uid-1');
      expect(batchSet).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
      const [, data] = batchSet.mock.calls[0]!;
      expect(data).toMatchObject({ listId: dst, name: 'Latte', category: 'dairy', addedVia: 'copy' });
    });

    it('tags move copies with addedVia move', async () => {
      await moveItem(listId, sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { addedVia: string }).addedVia).toBe('move');
    });

    it('preserves priority when copying', async () => {
      await copyItem({ ...sampleItem, priority: 'urgent' }, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as any).priority).toBe('urgent');
    });

    it('copies even when an item with the same name already exists in destination (duplicates allowed)', async () => {
      // No duplicate-check query is performed anymore - the call must succeed
      // regardless of pre-existing items with the same name.
      await copyItem(sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      expect(batchSet).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('does not delete the source item', async () => {
      await copyItem(sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      expect(batchDelete).not.toHaveBeenCalled();
      expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('increments destination itemCount in same batch', async () => {
      await copyItem(sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      expect(batchUpdate).toHaveBeenCalledTimes(1);
      const [, payload] = batchUpdate.mock.calls[0]!;
      expect((payload as any).itemCount).toEqual({ __increment: 1 });
    });

    it('capitalizes note when copying', async () => {
      await copyItem(
        { ...sampleItem, note: 'biologico' },
        '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID,
        'uid-1',
      );
      const [, data] = batchSet.mock.calls[0]!;
      expect((data as { note: string }).note).toBe('Biologico');
    });

    it('upserts per-list favorite state in the destination list', async () => {
      const dst = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;
      await copyItem(sampleItem, dst, 'uid-1');
      expect(upsertListFavorite).toHaveBeenCalledWith(dst, 'Latte', 'dairy');
    });
  });

  describe('moveItem', () => {
    it('writes destination and deletes source in a single batch', async () => {
      const dst = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;
      await moveItem(listId, sampleItem, dst, 'uid-1');
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchSet).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('updates both source and destination itemCount counters in the batch', async () => {
      await moveItem(listId, sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      const increments = batchUpdate.mock.calls.map((c) => (c[1] as any).itemCount);
      expect(increments).toEqual(
        expect.arrayContaining([{ __increment: 1 }, { __increment: -1 }]),
      );
    });

    it('moves even when an item with the same name already exists in destination (duplicates allowed)', async () => {
      await moveItem(listId, sampleItem, '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID, 'uid-1');
      expect(batchSet).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('upserts per-list favorite state in the destination list only', async () => {
      const dst = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;
      await moveItem(listId, sampleItem, dst, 'uid-1');
      expect(upsertListFavorite).toHaveBeenCalledOnce();
      expect(upsertListFavorite).toHaveBeenCalledWith(dst, 'Latte', 'dairy');
    });
  });
});
