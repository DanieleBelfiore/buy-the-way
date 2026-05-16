import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRef = { id: 'existing-entry' };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'entries' }),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  increment: vi.fn((n: number) => ({ type: 'increment', value: n })),
}));

import { upsertCatalogEntry, subscribeCatalog } from '@/services/catalog.service';
import { setDoc, updateDoc, getDocs, increment, onSnapshot } from 'firebase/firestore';
import type { CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const emptySnap = { empty: true, docs: [] };
const existingSnap = { empty: false, docs: [{ ref: mockRef, data: () => ({}) }] };

describe('catalog.service', () => {
  describe('upsertCatalogEntry', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(setDoc).mockResolvedValue(undefined);
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('creates new entry via setDoc when none exists', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      expect(setDoc).toHaveBeenCalledOnce();
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('new entry has usageCount = 1', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).usageCount).toBe(1);
    });

    it('new entry has correct name, category, ownerUid', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      await upsertCatalogEntry('uid-1', 'Pane', 'bakery');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({ name: 'Pane', category: 'bakery', ownerUid: 'uid-1' });
    });

    it('new entry has a 26-char ULID id', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).id).toHaveLength(26);
    });

    it('new entry has lastUsedAt as number', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(typeof (data as any).lastUsedAt).toBe('number');
    });

    it('calls updateDoc via increment when entry exists', async () => {
      vi.mocked(getDocs).mockResolvedValue(existingSnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      expect(updateDoc).toHaveBeenCalledOnce();
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('increments usageCount by 1 on existing entry', async () => {
      vi.mocked(getDocs).mockResolvedValue(existingSnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      expect(increment).toHaveBeenCalledWith(1);
      const [, data] = vi.mocked(updateDoc).mock.calls[0];
      expect((data as any).usageCount).toEqual({ type: 'increment', value: 1 });
    });

    it('updates lastUsedAt on existing entry', async () => {
      vi.mocked(getDocs).mockResolvedValue(existingSnap as any);
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      const [, data] = vi.mocked(updateDoc).mock.calls[0];
      expect(typeof (data as any).lastUsedAt).toBe('number');
    });

    it('queries by name to detect existing entry', async () => {
      vi.mocked(getDocs).mockResolvedValue(emptySnap as any);
      const { where } = await import('firebase/firestore');
      await upsertCatalogEntry('uid-1', 'Latte', 'dairy');
      expect(where).toHaveBeenCalledWith('name', '==', 'Latte');
    });
  });

  describe('subscribeCatalog', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns an unsubscribe function', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      const unsub = subscribeCatalog('uid-1', vi.fn(), vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('calls onSnapshot once', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      subscribeCatalog('uid-1', vi.fn(), vi.fn());
      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('maps snapshot docs to CatalogEntry objects and calls onChange', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_col, onNext: any, _onError: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });

      const onChange = vi.fn();
      subscribeCatalog('uid-1', onChange, vi.fn());

      const entry: CatalogEntry = {
        id: '01ABCDEFGH01234567890ABC12' as ULID,
        ownerUid: 'uid-1',
        name: 'Latte',
        category: 'dairy',
        usageCount: 2,
        lastUsedAt: 1000,
      };

      capturedNext!({
        docs: [{ id: entry.id, data: () => ({ ...entry }) }],
      });

      expect(onChange).toHaveBeenCalledOnce();
      const entries = onChange.mock.calls[0][0];
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ name: 'Latte', usageCount: 2 });
    });

    it('calls onError on snapshot error', () => {
      vi.mocked(onSnapshot).mockImplementation((_col, _onNext: any, onError: any) => {
        onError(new Error('permission-denied'));
        return vi.fn() as any;
      });

      const onError = vi.fn();
      subscribeCatalog('uid-1', vi.fn(), onError);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
