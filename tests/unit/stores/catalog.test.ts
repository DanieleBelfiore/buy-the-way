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
  usageCount: 2,
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

  describe('topIds', () => {
    it('returns empty set when no entries', () => {
      const store = useCatalogStore();
      expect(store.topIds.size).toBe(0);
    });

    it('returns set of first 2 ranked entry ids', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      const now = Date.now();
      capturedOnChange([
        makeEntry({ id: '01A' as ULID, usageCount: 1, lastUsedAt: now - 86_400_000 }),
        makeEntry({ id: '01B' as ULID, usageCount: 10, lastUsedAt: now }),
        makeEntry({ id: '01C' as ULID, usageCount: 5, lastUsedAt: now }),
      ]);
      expect(store.topIds.size).toBe(2);
      expect(store.topIds.has('01B' as ULID)).toBe(true);
      expect(store.topIds.has('01C' as ULID)).toBe(true);
    });

    it('returns set of size 1 when only 1 entry', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ id: '01A' as ULID })]);
      expect(store.topIds.size).toBe(1);
    });

    it('updates reactively when entries change', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ id: '01A' as ULID })]);
      expect(store.topIds.size).toBe(1);
      capturedOnChange([
        makeEntry({ id: '01A' as ULID }),
        makeEntry({ id: '01B' as ULID }),
      ]);
      expect(store.topIds.size).toBe(2);
    });
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

  describe('suggestionsFor (merged user + public catalog)', () => {
    it('returns matches from public catalog when user catalog is empty (it locale)', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('lat', 'it');
      expect(results.some((s) => s.name === 'Latte' && s.source === 'public')).toBe(true);
    });

    it('returns localized name (en) from public catalog', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('milk', 'en');
      expect(results.some((s) => s.name === 'Milk' && s.source === 'public')).toBe(true);
    });

    it('user catalog wins when same normalized name appears in both', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'Latte', usageCount: 5 })]);
      const results = store.suggestionsFor('lat', 'it');
      const latteMatches = results.filter((s) => s.name.toLowerCase() === 'latte');
      expect(latteMatches).toHaveLength(1);
      expect(latteMatches[0]!.source).toBe('user');
    });

    it('exact prefix match ranks before contains-only', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('pane', 'it');
      expect(results[0]!.name.toLowerCase()).toBe('pane');
    });

    it('returns custom-item fallback should be triggered: no match for novel name', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('xyzqwerty', 'it');
      expect(results).toHaveLength(0);
    });

    it('returns top entries when query is empty', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([makeEntry({ name: 'Latte' })]);
      const results = store.suggestionsFor('', 'it');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.source === 'user')).toBe(true);
    });

    it('respects limit', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('a', 'it', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('handles diacritics (caffè ↔ caffe)', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('caffe', 'it');
      expect(results.some((s) => s.name.startsWith('Caffè'))).toBe(true);
    });

    it('returns user catalog entries with usageCount=1 (below favorites threshold)', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([
        makeEntry({
          id: '01CUSTOM' as ULID,
          name: 'Babà',
          category: 'bakery',
          usageCount: 1,
        }),
      ]);
      const results = store.suggestionsFor('bab', 'it');
      expect(results.some((s) => s.name === 'Babà' && s.source === 'user')).toBe(true);
    });

    it('excludes user entries flagged excluded=true', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([
        makeEntry({ id: '01EX' as ULID, name: 'Zarbo', usageCount: 5, excluded: true }),
      ]);
      const results = store.suggestionsFor('zarb', 'it');
      expect(results.some((s) => s.name === 'Zarbo')).toBe(false);
    });
  });
});
