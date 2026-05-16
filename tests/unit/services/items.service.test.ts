import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'items' }),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
}));

vi.mock('@/services/catalog.service', () => ({
  upsertCatalogEntry: vi.fn().mockResolvedValue(undefined),
}));

import { subscribeItems, addItem, toggleChecked, removeItem } from '@/services/items.service';
import { setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { upsertCatalogEntry } from '@/services/catalog.service';
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
};

describe('items.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(updateDoc).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
    vi.mocked(upsertCatalogEntry).mockResolvedValue(undefined);
  });

  describe('addItem', () => {
    it('writes item doc via setDoc', async () => {
      await addItem(defaultAddParams);
      expect(setDoc).toHaveBeenCalledOnce();
    });

    it('includes all required Item fields in doc', async () => {
      await addItem(defaultAddParams);
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({
        listId,
        name: 'Latte',
        quantity: '1',
        category: 'dairy',
        note: '',
        checked: false,
        createdByUid: 'uid-1',
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
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).id).toBe(id);
    });

    it('calls upsertCatalogEntry with correct args', async () => {
      await addItem(defaultAddParams);
      expect(upsertCatalogEntry).toHaveBeenCalledOnce();
      expect(upsertCatalogEntry).toHaveBeenCalledWith('uid-1', 'Latte', 'dairy');
    });

    it('checked defaults to false', async () => {
      await addItem(defaultAddParams);
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).checked).toBe(false);
    });
  });

  describe('toggleChecked', () => {
    it('calls updateDoc', async () => {
      await toggleChecked(listId, itemId, true);
      expect(updateDoc).toHaveBeenCalledOnce();
    });

    it('patches only checked + updatedAt', async () => {
      await toggleChecked(listId, itemId, true);
      const [, data] = vi.mocked(updateDoc).mock.calls[0];
      expect(data).toMatchObject({ checked: true });
      expect(Object.keys(data as object)).toHaveLength(2);
      expect(Object.keys(data as object)).toContain('updatedAt');
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

    it('does not call setDoc or updateDoc', async () => {
      await removeItem(listId, itemId);
      expect(setDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
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
});
