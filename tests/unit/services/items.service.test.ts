import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('@/services/catalog.service', () => ({
  recordCatalogUse: vi.fn().mockResolvedValue(undefined),
}));

const {
  mockDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockDeleteDoc,
  mockOnSnapshot,
  mockCollection,
  mockQuery,
  mockOrderBy,
} = vi.hoisted(() => ({
  mockDoc: vi.fn((...args: any[]) => ({ path: (args.slice(1) as string[]).join('/') })),
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockOnSnapshot: vi.fn(() => vi.fn()),
  mockCollection: vi.fn((...args: any[]) => ({ path: (args.slice(1) as string[]).join('/') })),
  mockQuery: vi.fn((...args: any[]) => args),
  mockOrderBy: vi.fn((...args: any[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  orderBy: mockOrderBy,
}));

import {
  addItem,
  toggleChecked,
  updateItem,
  removeItem,
  subscribeItems,
} from '@/services/items.service';
import type { Item } from '@/domain/types';

const BASE_ITEM: Item = {
  id: 'item-1' as any,
  listId: 'list-xyz' as any,
  name: 'Milk',
  quantity: '1l',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-owner',
  createdAt: 1000,
  updatedAt: 1000,
};

describe('items.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('addItem', () => {
    it('calls setDoc on the items subcollection', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await addItem('list-xyz' as any, BASE_ITEM);
      expect(mockSetDoc).toHaveBeenCalledOnce();
    });

    it('triggers recordCatalogUse fire-and-forget', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { recordCatalogUse } = await import('@/services/catalog.service');
      await addItem('list-xyz' as any, BASE_ITEM);
      expect(vi.mocked(recordCatalogUse)).toHaveBeenCalledWith(
        BASE_ITEM.createdByUid,
        BASE_ITEM.name,
        BASE_ITEM.category,
      );
    });
  });

  describe('toggleChecked', () => {
    it('calls updateDoc with flipped checked and updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await toggleChecked('list-xyz' as any, 'item-1' as any, false);
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).checked).toBe(true);
      expect(typeof (patch as any).updatedAt).toBe('number');
    });
  });

  describe('updateItem', () => {
    it('calls updateDoc with patch fields and updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await updateItem('list-xyz' as any, 'item-1' as any, { name: 'Oat Milk' });
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).name).toBe('Oat Milk');
      expect(typeof (patch as any).updatedAt).toBe('number');
    });
  });

  describe('removeItem', () => {
    it('calls deleteDoc', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      await removeItem('list-xyz' as any, 'item-1' as any);
      expect(mockDeleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('subscribeItems', () => {
    it('returns an unsubscribe function', () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);
      const result = subscribeItems('list-xyz' as any, vi.fn());
      expect(typeof result).toBe('function');
    });
  });
});
