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

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(subscribeCatalog).mockImplementation((_uid, onChange, _onError) => {
      capturedOnChange = onChange;
      return vi.fn();
    });
  });

  describe('suggestionsFor (merged user + public catalog)', () => {
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

    it('handles diacritics (caffè ↔ caffe)', () => {
      const store = useCatalogStore();
      const results = store.suggestionsFor('caffe', 'it');
      expect(results.some((s) => s.name.startsWith('Caffè'))).toBe(true);
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
  });
});
