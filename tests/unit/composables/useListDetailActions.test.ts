import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { setActivePinia, createPinia } from 'pinia';

const bulkSnapshot = vi.fn(() => [] as string[]);
const bulkCount = ref(0);
const bulkEnter = vi.fn();
const bulkToggle = vi.fn();
const bulkExit = vi.fn();

vi.mock('@/services/history.service', () => ({
  recordListHistory: vi.fn().mockResolvedValue('hist-1'),
  fetchListHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/items.service', () => ({
  addItem: vi.fn().mockResolvedValue(undefined),
  toggleChecked: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
  bulkAddItems: vi.fn().mockResolvedValue(undefined),
  bulkRemoveItems: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  setItemPriority: vi.fn().mockResolvedValue(undefined),
  copyItem: vi.fn().mockResolvedValue(undefined),
  moveItem: vi.fn().mockResolvedValue(undefined),
  bulkCopyItems: vi.fn().mockResolvedValue(undefined),
  bulkMoveItems: vi.fn().mockResolvedValue(undefined),
  emptyList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/listFavorites.service', () => ({
  ensureListFavorite: vi.fn().mockResolvedValue('slug-1'),
  patchListFavorite: vi.fn().mockResolvedValue(undefined),
  setListFavoriteState: vi.fn().mockResolvedValue(undefined),
  setListFavoriteExcluded: vi.fn().mockResolvedValue(undefined),
  findListFavoriteByName: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/catalog.service', () => ({
  findCatalogEntryByName: vi.fn(),
  deleteCatalogEntry: vi.fn(),
  upsertCatalogEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/itemPhotos.service', () => ({
  uploadItemPhoto: vi.fn(),
  removeItemPhoto: vi.fn(),
}));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref('en'),
    }),
  };
});

vi.mock('@/stores/catalog', () => ({
  useCatalogStore: vi.fn(() => ({
    inferCategoryForName: vi.fn(() => 'other'),
  })),
}));

vi.mock('@/stores/listFavorites', () => ({
  useListFavoritesStore: vi.fn(() => ({
    pinnedNames: new Set<string>(['Milk']),
  })),
}));

vi.mock('@/composables/useUndoDelete', () => ({
  useUndoDelete: () => ({
    schedule: vi.fn(),
    pending: ref(null),
  }),
}));

vi.mock('@/composables/useBulkSelection', () => ({
  useBulkSelection: () => ({
    enter: bulkEnter,
    toggle: bulkToggle,
    exit: bulkExit,
    snapshot: bulkSnapshot,
    count: bulkCount,
  }),
}));

vi.mock('@/composables/useHaptic', () => ({
  useHaptic: () => ({ pulse: vi.fn() }),
}));

import { recordListHistory } from '@/services/history.service';
import {
  clearListHistoryRecorded,
  markListHistoryRecorded
} from '@/domain/listHistoryCycle';
import {
  addItem,
  removeItem,
  emptyList,
  bulkAddItems
} from '@/services/items.service';
import {
  setListFavoriteState,
  findListFavoriteByName
} from '@/services/listFavorites.service';
import {
  findCatalogEntryByName,
  deleteCatalogEntry
} from '@/services/catalog.service';
import { useListDetailActions } from '@/composables/useListDetailActions';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import type { Category, Item} from '@/domain/types';
import type { ULID } from '@/domain/id';

const ITEM_ID = '01ITEM000000000000000000001' as ULID;
const LIST_ID = '01LIST00000000000000000001' as ULID;

const sampleItem = (): Item => ({
  id: ITEM_ID,
  listId: LIST_ID,
  name: 'Milk',
  quantity: '',
  note: '',
  category: 'dairy',
  checked: false,
  createdByUid: 'user-1',
  createdAt: 1,
  updatedAt: 1,
});

describe('useListDetailActions', () => {
  const listId = computed(() => LIST_ID);
  const previouslyAllChecked = new Set<Category>();
  const expandIfCollapsed = vi.fn();

  const setup = () =>
    useListDetailActions({
      listId,
      expandIfCollapsed,
      previouslyAllChecked,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    bulkSnapshot.mockReturnValue([]);
    bulkCount.value = 0;
    previouslyAllChecked.clear();
    localStorage.clear();
    clearListHistoryRecorded(LIST_ID);
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.user = { uid: 'user-1', email: 'u@example.com', displayName: 'User' } as any;
    const items = useItemsStore();
    items.items = [sampleItem()];
  });

  it('confirmRemove schedules undo-delete for the targeted item', async () => {
    const { handleRemoveItem, confirmRemove, undoItemDelete } = setup();
    handleRemoveItem(ITEM_ID);
    await confirmRemove();
    expect(undoItemDelete.schedule).toHaveBeenCalledOnce();
    expect(undoItemDelete.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: ITEM_ID }),
    );
  });

  it('handleEmptyList clears all item ids via the service', async () => {
    const { handleEmptyList } = setup();
    await handleEmptyList();
    expect(recordListHistory).toHaveBeenCalledWith(
      LIST_ID,
      [sampleItem()],
      'user-1',
      'empty_fallback',
    );
    expect(emptyList).toHaveBeenCalledWith(LIST_ID, [ITEM_ID]);
  });

  it('handleEmptyList with checked scope removes bought items and records them in history', async () => {
    const bought = { ...sampleItem(), id: '01ITEM000000000000000000002' as ULID, checked: true };
    useItemsStore().items = [sampleItem(), bought];
    const { handleEmptyList } = setup();
    await handleEmptyList('checked');
    expect(recordListHistory).toHaveBeenCalledWith(
      LIST_ID,
      [bought],
      'user-1',
      'empty_fallback',
    );
    expect(emptyList).toHaveBeenCalledWith(LIST_ID, [bought.id]);
  });

  it('handleEmptyList skips history when already recorded this cycle', async () => {
    markListHistoryRecorded(LIST_ID);
    const { handleEmptyList } = setup();
    await handleEmptyList();
    expect(recordListHistory).not.toHaveBeenCalled();
    expect(emptyList).toHaveBeenCalledOnce();
  });

  it('bulk-deletes selected items via undo schedule', async () => {
    bulkSnapshot.mockReturnValue([ITEM_ID]);
    bulkCount.value = 1;
    const { handleBulkDelete, undoItemDelete } = setup();
    await handleBulkDelete();
    expect(bulkExit).toHaveBeenCalled();
    expect(undoItemDelete.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: ITEM_ID }),
    );
  });

  describe('suggest sheet', () => {

    it('adds the picked suggestions with their last quantity and closes', async () => {
      const { openSuggest, handleSuggestSubmit, suggestOpen } = setup();
      await openSuggest();
      await handleSuggestSubmit([
        {
          key: 'bread',
          name: 'Bread',
          category: 'bakery',
          quantity: '2',
          purchaseCount: 3,
          intervalDays: 7,
          preselected: true,
        },
      ]);
      expect(bulkAddItems).toHaveBeenCalledWith({
        listId: LIST_ID,
        rows: [{ name: 'Bread', category: 'bakery', quantity: '2' }],
        createdByUid: 'user-1',
        addedVia: 'suggested',
      });
      expect(expandIfCollapsed).toHaveBeenCalledWith('bakery');
      expect(suggestOpen.value).toBe(false);
    });
  });

  it('handleShelfAdd removes the matching item when it is already on the list', async () => {
    const entry = {
      slug: 'milk',
      name: 'Milk',
      category: 'dairy' as Category,
      usageCount: 1,
      lastUsedAt: 1,
    };
    const { handleShelfAdd } = setup();
    await handleShelfAdd(entry);
    expect(removeItem).toHaveBeenCalledWith(LIST_ID, ITEM_ID);
    expect(addItem).not.toHaveBeenCalled();
    expect(useItemsStore().pendingDeleteIds.has(ITEM_ID)).toBe(false);
  });

  it('handleShelfAdd removes every duplicate row for the same favorite', async () => {
    const second = { ...sampleItem(), id: '01ITEM000000000000000000002' as ULID, name: 'milk ' };
    useItemsStore().items = [sampleItem(), second];
    const entry = {
      slug: 'milk',
      name: 'Milk',
      category: 'dairy' as Category,
      usageCount: 1,
      lastUsedAt: 1,
    };
    const { handleShelfAdd } = setup();
    await handleShelfAdd(entry);
    expect(removeItem).toHaveBeenCalledWith(LIST_ID, ITEM_ID);
    expect(removeItem).toHaveBeenCalledWith(LIST_ID, second.id);
    expect(addItem).not.toHaveBeenCalled();
  });

  it('handleShelfAdd ignores items already queued for delete', async () => {
    const items = useItemsStore();
    items.markPendingDelete(ITEM_ID);
    const entry = {
      slug: 'milk',
      name: 'Milk',
      category: 'dairy' as Category,
      usageCount: 1,
      lastUsedAt: 1,
    };
    const { handleShelfAdd } = setup();
    await handleShelfAdd(entry);
    expect(removeItem).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Milk', addedVia: 'favorite' }),
    );
  });

  it('handleDontSuggestConfirm deletes catalog entry and unpins favorite', async () => {
    vi.mocked(findCatalogEntryByName).mockResolvedValue({
      id: '01CAT00000000000000000001' as ULID,
      ownerUid: 'user-1',
      name: 'Custom thing',
      category: 'other',
      usageCount: 1,
      lastUsedAt: 1,
    });
    vi.mocked(findListFavoriteByName).mockResolvedValue({
      slug: 'custom',
      name: 'Custom thing',
      category: 'other',
      usageCount: 1,
      lastUsedAt: 1,
      pinned: true,
    });
    const { handleDontSuggestConfirm, dontSuggestCandidate } = setup();
    dontSuggestCandidate.value = {
      name: 'Custom thing',
      entryId: '01CAT00000000000000000001' as ULID,
    };
    await handleDontSuggestConfirm();
    expect(deleteCatalogEntry).toHaveBeenCalledWith('user-1', '01CAT00000000000000000001');
    expect(setListFavoriteState).toHaveBeenCalledWith(LIST_ID, 'custom', false);
    expect(dontSuggestCandidate.value).toBeNull();
  });
});
