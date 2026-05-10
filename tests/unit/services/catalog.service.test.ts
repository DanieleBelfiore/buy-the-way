import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));

const { mockDoc, mockSetDoc, mockOnSnapshot, mockCollection, mockQuery, mockWhere, mockIncrement } =
  vi.hoisted(() => ({
    mockDoc: vi.fn((...args: any[]) => ({ path: (args.slice(1) as string[]).join('/') })),
    mockSetDoc: vi.fn(),
    mockOnSnapshot: vi.fn(() => vi.fn()),
    mockCollection: vi.fn((...args: any[]) => ({ path: args[1] as string })),
    mockQuery: vi.fn((...args: any[]) => args),
    mockWhere: vi.fn((...args: any[]) => args),
    mockIncrement: vi.fn((n: number) => ({ _type: 'increment', n })),
  }));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
  increment: mockIncrement,
}));

import { recordCatalogUse, subscribeCatalog } from '@/services/catalog.service';

describe('catalog.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('recordCatalogUse', () => {
    it('calls setDoc with merge:true for the catalog entry', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await recordCatalogUse('uid-owner', 'Milk', 'dairy');
      expect(mockSetDoc).toHaveBeenCalledOnce();
      const [, , opts] = mockSetDoc.mock.calls[0]!;
      expect(opts).toEqual({ merge: true });
    });

    it('uses increment(1) for usageCount', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await recordCatalogUse('uid-owner', 'Milk', 'dairy');
      const [, data] = mockSetDoc.mock.calls[0]!;
      expect((data as any).usageCount._type).toBe('increment');
      expect((data as any).usageCount.n).toBe(1);
    });

    it('normalizes name to lowercase for the doc key', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await recordCatalogUse('uid-owner', 'MILK', 'dairy');
      const [ref] = mockSetDoc.mock.calls[0]!;
      expect((ref as any).path).toMatch(/milk/);
    });

    it('stores the display name as-is in the document', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await recordCatalogUse('uid-owner', 'Whole Milk', 'dairy');
      const [, data] = mockSetDoc.mock.calls[0]!;
      expect((data as any).name).toBe('Whole Milk');
    });
  });

  describe('subscribeCatalog', () => {
    it('returns an unsubscribe function', () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);
      const result = subscribeCatalog('uid-owner', vi.fn());
      expect(typeof result).toBe('function');
    });
  });
});
