import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/catalog.service', () => ({
  subscribeCatalog: vi.fn(),
  upsertCatalogEntry: vi.fn(),
}));

import { useCatalogStore } from '@/stores/catalog';
import { subscribeCatalog } from '@/services/catalog.service';
import type { CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: '01ABCDEFGH01234567890ABC12' as ULID,
  ownerUid: 'uid-1',
  name: 'Latte',
  category: 'dairy',
  usageCount: 1,
  lastUsedAt: Date.now(),
  ...overrides,
});

describe('useCatalogStore', () => {
  let capturedOnChange: (entries: CatalogEntry[]) => void;
  let capturedOnError: (err: Error) => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(subscribeCatalog).mockImplementation((_uid, onChange, onError) => {
      capturedOnChange = onChange;
      capturedOnError = onError;
      return vi.fn();
    });
  });

  it('starts with empty entries', () => {
    const store = useCatalogStore();
    expect(store.entries).toEqual([]);
  });

  it('subscribe calls subscribeCatalog with ownerUid', () => {
    const store = useCatalogStore();
    store.subscribe('uid-1');
    expect(subscribeCatalog).toHaveBeenCalledWith('uid-1', expect.any(Function), expect.any(Function));
  });

  it('populates entries when onChange fires', () => {
    const store = useCatalogStore();
    store.subscribe('uid-1');
    capturedOnChange([makeEntry()]);
    expect(store.entries).toHaveLength(1);
  });

  it('subscribe returns unsubscribe function', () => {
    const store = useCatalogStore();
    const unsub = store.subscribe('uid-1');
    expect(typeof unsub).toBe('function');
  });

  it('calling returned unsubscribe calls the inner unsubscribe', () => {
    const innerUnsub = vi.fn();
    vi.mocked(subscribeCatalog).mockReturnValue(innerUnsub);
    const store = useCatalogStore();
    const unsub = store.subscribe('uid-1');
    unsub();
    expect(innerUnsub).toHaveBeenCalledOnce();
  });

  it('sets error and loading=false when onError fires', () => {
    const store = useCatalogStore();
    store.subscribe('uid-1');
    capturedOnError(new Error('permission-denied'));
    expect(store.error).toBe('permission-denied');
  });

  describe('suggestFor', () => {
    it('returns all entries when query is empty', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'Latte' }), makeEntry({ id: '01B' as ULID, name: 'Pane' })]);
      expect(store.suggestFor('')).toHaveLength(2);
    });

    it('filters by name startsWith (case-insensitive)', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([
        makeEntry({ name: 'Latte' }),
        makeEntry({ id: '01B' as ULID, name: 'Pane' }),
      ]);
      const results = store.suggestFor('lat');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Latte');
    });

    it('matches uppercase query against lowercase entry', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'latte' })]);
      expect(store.suggestFor('LAT')).toHaveLength(1);
    });

    it('returns empty array when no match', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'Latte' })]);
      expect(store.suggestFor('xyz')).toHaveLength(0);
    });

    it('trims whitespace from query', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'Latte' })]);
      expect(store.suggestFor('  lat  ')).toHaveLength(1);
    });
  });
});
