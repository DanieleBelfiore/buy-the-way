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

    it('exclude/dismiss flags are now per-list and do not affect autocomplete suggestions', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      // Cast accommodates legacy docs that may still carry the flag in
      // Firestore - the store must ignore them now that favorites are per-list.
      capturedOnChange([
        makeEntry({ id: '01EX' as ULID, name: 'Zarbo', usageCount: 5, ...({ excluded: true } as object) } as CatalogEntry),
      ]);
      const results = store.suggestionsFor('zarb', 'it');
      expect(results.some((s) => s.name === 'Zarbo')).toBe(true);
    });
  });

  describe('inferCategoryForName (bulk-paste helper)', () => {
    it('matches an entry from the user catalog and returns its category', () => {
      const store = useCatalogStore();
      store.subscribe('uid-1');
      capturedOnChange([
        makeEntry({ id: '01USR' as ULID, name: 'Mela rossa', category: 'fruit_vegetables' }),
      ]);
      expect(store.inferCategoryForName('Mela rossa', 'it')).toBe('fruit_vegetables');
    });

    it('falls back to the public catalog when no user entry matches', () => {
      const store = useCatalogStore();
      // `Latte` is a known public-catalog entry in the dairy category.
      expect(store.inferCategoryForName('Latte', 'it')).toBe('dairy');
    });

    it('returns "other" when no match exists in either catalog', () => {
      const store = useCatalogStore();
      expect(store.inferCategoryForName('Quaglie marinate', 'it')).toBe('other');
    });

    it('returns "other" for empty input', () => {
      const store = useCatalogStore();
      expect(store.inferCategoryForName('', 'it')).toBe('other');
    });

    it('matches case-insensitively via normalize', () => {
      const store = useCatalogStore();
      expect(store.inferCategoryForName('  LATTE  ', 'it')).toBe('dairy');
    });
  });
});
