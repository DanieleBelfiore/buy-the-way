import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/listFavorites.service', () => ({
  subscribeListFavorites: vi.fn(),
}));

import { useListFavoritesStore } from '@/stores/listFavorites';
import { subscribeListFavorites } from '@/services/listFavorites.service';
import { FAVORITES_MIN_USES } from '@/domain/ranking';
import type { ListFavoriteState } from '@/domain/types';
import type { ULID } from '@/domain/id';

const listId = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as ULID;
const otherListId = '01ARZ3NDEKTSV4RRFFQ69G5OTH' as ULID;

const makeEntry = (overrides: Partial<ListFavoriteState> = {}): ListFavoriteState => ({
  slug: overrides.slug ?? 'latte',
  name: overrides.name ?? 'Latte',
  category: overrides.category ?? 'dairy',
  usageCount: overrides.usageCount ?? FAVORITES_MIN_USES,
  lastUsedAt: overrides.lastUsedAt ?? Date.now(),
  ...(overrides.pinned !== undefined && { pinned: overrides.pinned }),
  ...(overrides.excluded !== undefined && { excluded: overrides.excluded }),
  ...(overrides.dismissedFavorite !== undefined && {
    dismissedFavorite: overrides.dismissedFavorite,
  }),
});

describe('useListFavoritesStore', () => {
  let capturedOnChange: (entries: ListFavoriteState[]) => void;
  let capturedOnError: (err: Error) => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(subscribeListFavorites).mockImplementation((_listId, onChange, onError) => {
      capturedOnChange = onChange;
      capturedOnError = onError;
      return vi.fn();
    });
  });

  it('starts empty', () => {
    const store = useListFavoritesStore();
    expect(store.entries).toEqual([]);
    expect(store.currentListId).toBeNull();
  });

  it('subscribe sets currentListId and calls service', () => {
    const store = useListFavoritesStore();
    store.subscribe(listId);
    expect(subscribeListFavorites).toHaveBeenCalledWith(
      listId,
      expect.any(Function),
      expect.any(Function),
    );
    expect(store.currentListId).toBe(listId);
  });

  it('populates entries when onChange fires', () => {
    const store = useListFavoritesStore();
    store.subscribe(listId);
    capturedOnChange([makeEntry()]);
    expect(store.entries).toHaveLength(1);
  });

  it('sets error when onError fires', () => {
    const store = useListFavoritesStore();
    store.subscribe(listId);
    capturedOnError(new Error('permission-denied'));
    expect(store.error).toBe('permission-denied');
  });

  it('switching subscription to a different list clears previous entries', () => {
    const innerUnsub = vi.fn();
    vi.mocked(subscribeListFavorites).mockImplementationOnce((_lid, onChange, onError) => {
      capturedOnChange = onChange;
      capturedOnError = onError;
      return innerUnsub;
    });
    const store = useListFavoritesStore();
    store.subscribe(listId);
    capturedOnChange([makeEntry({ slug: 'latte' })]);
    expect(store.entries).toHaveLength(1);

    vi.mocked(subscribeListFavorites).mockImplementationOnce((_lid, onChange, onError) => {
      capturedOnChange = onChange;
      capturedOnError = onError;
      return vi.fn();
    });
    store.subscribe(otherListId);
    expect(store.entries).toHaveLength(0);
    expect(store.currentListId).toBe(otherListId);
    expect(innerUnsub).toHaveBeenCalledOnce();
  });

  describe('rankedEntries / pinnedNames', () => {
    it('ranks entries through rankListFavorites (auto-promote at threshold)', () => {
      const store = useListFavoritesStore();
      store.subscribe(listId);
      capturedOnChange([
        makeEntry({ slug: 'latte', name: 'Latte', usageCount: 5 }),
        makeEntry({ slug: 'pane', name: 'Pane', usageCount: 1 }),
      ]);
      const slugs = store.rankedEntries.map((e) => e.slug);
      expect(slugs).toContain('latte');
      expect(slugs).not.toContain('pane');
    });

    it('pinnedNames is the set of names that appear in the favorites shelf', () => {
      const store = useListFavoritesStore();
      store.subscribe(listId);
      capturedOnChange([
        makeEntry({ slug: 'latte', name: 'Latte', usageCount: 5 }),
        makeEntry({ slug: 'pane', name: 'Pane', usageCount: 1 }),
      ]);
      expect(store.pinnedNames.has('Latte')).toBe(true);
      expect(store.pinnedNames.has('Pane')).toBe(false);
    });

    it('dismissedFavorite removes an auto-promoted entry from pinnedNames', () => {
      const store = useListFavoritesStore();
      store.subscribe(listId);
      capturedOnChange([
        makeEntry({ slug: 'latte', name: 'Latte', usageCount: 10, dismissedFavorite: true }),
      ]);
      expect(store.pinnedNames.has('Latte')).toBe(false);
    });

    it('explicit pin overrides dismissedFavorite', () => {
      const store = useListFavoritesStore();
      store.subscribe(listId);
      capturedOnChange([
        makeEntry({ slug: 'latte', name: 'Latte', usageCount: 0, pinned: true, dismissedFavorite: true }),
      ]);
      expect(store.pinnedNames.has('Latte')).toBe(true);
    });
  });
});
