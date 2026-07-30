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
  markListHistoryRecorded,
} from '@/domain/listHistoryCycle';
import {
  addItem,
  toggleChecked,
  emptyList,
  updateItem,
  setItemPriority,
  copyItem,
  moveItem,
  bulkAddItems,
  bulkCopyItems,
  bulkMoveItems,
} from '@/services/items.service';
import {
  ensureListFavorite,
  patchListFavorite,
  setListFavoriteState,
  setListFavoriteExcluded,
  findListFavoriteByName,
} from '@/services/listFavorites.service';
import {
  findCatalogEntryByName,
  deleteCatalogEntry,
  upsertCatalogEntry,
} from '@/services/catalog.service';
import { uploadItemPhoto, removeItemPhoto } from '@/services/itemPhotos.service';
import { useListDetailActions } from '@/composables/useListDetailActions';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import type { Category, Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const ITEM_ID = '01ITEM000000000000000000001' as ULID;
const LIST_ID = '01LIST00000000000000000001' as ULID;
const OTHER_LIST = '01LIST00000000000000000002' as ULID;

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

  it('addItem delegates to the items service and expands the category', async () => {
    const { handleAddItem } = setup();
    await handleAddItem({
      name: 'Bread',
      category: 'bakery',
      quantity: '1',
      note: '',
    });
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: LIST_ID,
        name: 'Bread',
        category: 'bakery',
        createdByUid: 'user-1',
        addedVia: 'autocomplete',
      }),
    );
    expect(expandIfCollapsed).toHaveBeenCalledWith('bakery');
  });

  it('skips addItem when there is no authenticated user', async () => {
    useAuthStore().user = null;
    const { handleAddItem } = setup();
    await handleAddItem({ name: 'X', category: 'other', quantity: '', note: '' });
    expect(addItem).not.toHaveBeenCalled();
  });

  it('toggleChecked delegates to the items service', async () => {
    const { handleToggleChecked } = setup();
    await handleToggleChecked(ITEM_ID, true);
    expect(toggleChecked).toHaveBeenCalledWith(LIST_ID, ITEM_ID, true);
  });

  it('shows first-check tutorial toast once when marking bought', async () => {
    const { handleToggleChecked, toggleToastOpen, toggleToastMessage } = setup();
    await handleToggleChecked(ITEM_ID, true);
    expect(toggleToastOpen.value).toBe(true);
    expect(toggleToastMessage.value).toBe('item.firstCheckTutorialToast');
    toggleToastOpen.value = false;
    await handleToggleChecked(ITEM_ID, true);
    expect(toggleToastOpen.value).toBe(false);
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

  it('cancelRemove clears the remove modal state', () => {
    const { handleRemoveItem, cancelRemove, removeModalOpen } = setup();
    handleRemoveItem(ITEM_ID);
    expect(removeModalOpen.value).toBe(true);
    cancelRemove();
    expect(removeModalOpen.value).toBe(false);
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
    expect(emptyList).toHaveBeenCalledWith(LIST_ID, [ITEM_ID], { urgentRemoved: 0 });
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
    expect(emptyList).toHaveBeenCalledWith(
      LIST_ID,
      [bought.id],
      { urgentRemoved: 0 },
    );
  });

  it('handleEmptyList skips history when already recorded this cycle', async () => {
    markListHistoryRecorded(LIST_ID);
    const { handleEmptyList } = setup();
    await handleEmptyList();
    expect(recordListHistory).not.toHaveBeenCalled();
    expect(emptyList).toHaveBeenCalledOnce();
  });

  it('opens and saves the edit sheet', async () => {
    vi.mocked(findListFavoriteByName).mockResolvedValue({
      slug: 'milk',
      name: 'Milk',
      category: 'dairy',
      usageCount: 1,
      lastUsedAt: 1,
      pinned: true,
    });
    const { handleOpenItemEdit, handleEditSave, editSheetOpen, editingItem } = setup();
    await handleOpenItemEdit(sampleItem());
    expect(editSheetOpen.value).toBe(true);
    expect(editingItem.value?.name).toBe('Milk');
    await handleEditSave({
      name: 'Oat milk',
      quantity: '2',
      note: 'cold',
      category: 'dairy',
      pinned: false,
    });
    expect(updateItem).toHaveBeenCalledWith(
      LIST_ID,
      ITEM_ID,
      expect.objectContaining({ name: 'Oat milk', quantity: '2' }),
    );
    expect(patchListFavorite).toHaveBeenCalledWith(LIST_ID, 'milk', {
      name: 'Oat milk',
      category: 'dairy',
    });
    expect(setListFavoriteState).toHaveBeenCalledWith(LIST_ID, 'milk', false);
    expect(editSheetOpen.value).toBe(false);
    // Same category as before ('dairy') - no catalog re-sync needed.
    expect(upsertCatalogEntry).not.toHaveBeenCalled();
  });

  it('persists a corrected category to the catalog so future adds default to it', async () => {
    vi.mocked(findListFavoriteByName).mockResolvedValue(null);
    const custom: Item = { ...sampleItem(), name: 'Kombucha', category: 'other' };
    useItemsStore().items = [custom];
    const { handleOpenItemEdit, handleEditSave } = setup();
    await handleOpenItemEdit(custom);
    await handleEditSave({
      name: 'Kombucha',
      quantity: '',
      note: '',
      category: 'beverages',
      pinned: false,
    });
    expect(upsertCatalogEntry).toHaveBeenCalledWith('user-1', 'Kombucha', 'beverages');
  });

  it('pins a not-yet-favorited item on save via ensureListFavorite', async () => {
    // No existing favorite record for this item, and it is not currently pinned.
    vi.mocked(findListFavoriteByName).mockResolvedValue(null);
    const bread: Item = { ...sampleItem(), name: 'Bread', category: 'bakery' };
    useItemsStore().items = [bread];
    const { handleOpenItemEdit, handleEditSave } = setup();
    await handleOpenItemEdit(bread);
    await handleEditSave({
      name: 'Bread',
      quantity: '',
      note: '',
      category: 'bakery',
      pinned: true,
    });
    expect(ensureListFavorite).toHaveBeenCalledWith(LIST_ID, 'Bread', 'bakery');
    expect(setListFavoriteState).toHaveBeenCalledWith(LIST_ID, 'slug-1', true);
  });

  it('handleEditCancel closes the edit sheet', async () => {
    const { handleOpenItemEdit, handleEditCancel, editSheetOpen } = setup();
    await handleOpenItemEdit(sampleItem());
    handleEditCancel();
    expect(editSheetOpen.value).toBe(false);
  });

  it('uploads and removes item photos', async () => {
    const item = sampleItem();
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const { handleEditUploadPhoto, handleEditRemovePhoto } = setup();
    await handleEditUploadPhoto(item, file);
    expect(uploadItemPhoto).toHaveBeenCalledWith(LIST_ID, ITEM_ID, file);
    await handleEditRemovePhoto(item);
    expect(removeItemPhoto).toHaveBeenCalledWith(LIST_ID, ITEM_ID);
  });

  it('toggles pinned state via list favorites', async () => {
    const { handleTogglePinned } = setup();
    await handleTogglePinned(sampleItem());
    expect(ensureListFavorite).toHaveBeenCalledWith(LIST_ID, 'Milk', 'dairy');
    expect(setListFavoriteState).toHaveBeenCalledWith(LIST_ID, 'slug-1', false);
  });

  it('handles single-item move and copy picker flows', async () => {
    const item = sampleItem();
    const { handleOpenMoveCopy, handlePickerCopy, handlePickerMove, pickerOpen } = setup();
    handleOpenMoveCopy(item);
    expect(pickerOpen.value).toBe(true);
    await handlePickerCopy(OTHER_LIST);
    expect(copyItem).toHaveBeenCalledWith(item, OTHER_LIST, 'user-1');
    handleOpenMoveCopy(item);
    await handlePickerMove(OTHER_LIST);
    expect(moveItem).toHaveBeenCalledWith(LIST_ID, item, OTHER_LIST, 'user-1');
  });

  it('sets priority for a single item', async () => {
    const { handleRequestPriority, handlePrioritySelect, priorityOpen } = setup();
    handleRequestPriority(sampleItem());
    expect(priorityOpen.value).toBe(true);
    await handlePrioritySelect('high');
    expect(setItemPriority).toHaveBeenCalledWith(LIST_ID, ITEM_ID, 'high');
    expect(priorityOpen.value).toBe(false);
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

  it('bulk move and copy delegate to items service', async () => {
    bulkSnapshot.mockReturnValue([ITEM_ID]);
    bulkCount.value = 1;
    const { handleBulkPickerMove, handleBulkPickerCopy } = setup();
    await handleBulkPickerMove(OTHER_LIST);
    expect(bulkMoveItems).toHaveBeenCalled();
    bulkSnapshot.mockReturnValue([ITEM_ID]);
    await handleBulkPickerCopy(OTHER_LIST);
    expect(bulkCopyItems).toHaveBeenCalled();
  });

  it('submits bulk paste and voice rows', async () => {
    const rows = [
      { name: 'Eggs', category: 'dairy' as Category },
      { name: 'Bread', category: 'bakery' as Category },
    ];
    const { handleBulkPasteSubmit, handleVoiceAddSubmit, bulkPasteOpen, voiceAddOpen } = setup();
    bulkPasteOpen.value = true;
    await handleBulkPasteSubmit(rows);
    expect(bulkAddItems).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: LIST_ID,
        addedVia: 'bulk',
        rows: expect.arrayContaining([{ name: 'Eggs', category: 'dairy' }]),
      }),
    );
    expect(expandIfCollapsed).toHaveBeenCalledWith('dairy');
    expect(bulkPasteOpen.value).toBe(false);
    voiceAddOpen.value = true;
    await handleVoiceAddSubmit([{ name: 'Butter', category: 'dairy' }]);
    expect(voiceAddOpen.value).toBe(false);
    expect(bulkAddItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ addedVia: 'voice' }),
    );
  });

  it('adds shelf favorites and confirms exclude', async () => {
    const entry = {
      slug: 'milk',
      name: 'Milk',
      category: 'dairy' as Category,
      usageCount: 1,
      lastUsedAt: 1,
      pinned: true,
    };
    const { handleShelfAdd, handleShelfExclude, confirmExclude, excludeModalOpen } = setup();
    await handleShelfAdd(entry);
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Milk', category: 'dairy', addedVia: 'favorite' }),
    );
    handleShelfExclude(entry);
    expect(excludeModalOpen.value).toBe(true);
    await confirmExclude();
    expect(setListFavoriteExcluded).toHaveBeenCalledWith(LIST_ID, 'milk', true);
    expect(excludeModalOpen.value).toBe(false);
  });

  it('wires bulk selection helpers', () => {
    const item = sampleItem();
    const {
      handleSelectEnter,
      handleSelectToggle,
      cancelBulkSelection,
      openBulkPicker,
      bulkPickerOpen,
    } = setup();
    handleSelectEnter(item);
    expect(bulkEnter).toHaveBeenCalledWith(ITEM_ID);
    handleSelectToggle(item);
    expect(bulkToggle).toHaveBeenCalledWith(ITEM_ID);
    cancelBulkSelection();
    expect(bulkExit).toHaveBeenCalled();
    bulkCount.value = 0;
    openBulkPicker('move');
    expect(bulkPickerOpen.value).toBe(false);
    bulkCount.value = 2;
    openBulkPicker('move');
    expect(bulkPickerOpen.value).toBe(true);
  });

  it('handleBulkPriority opens priority picker in bulk mode', () => {
    bulkSnapshot.mockReturnValue([ITEM_ID]);
    const { handleBulkPriority, priorityOpen, handlePriorityCancel } = setup();
    handleBulkPriority();
    expect(priorityOpen.value).toBe(true);
    handlePriorityCancel();
    expect(priorityOpen.value).toBe(false);
  });

  it('handlePrioritySelect applies priority to all bulk-selected ids', async () => {
    bulkSnapshot.mockReturnValue([ITEM_ID]);
    bulkCount.value = 1;
    const { handleBulkPriority, handlePrioritySelect } = setup();
    handleBulkPriority();
    await handlePrioritySelect('low');
    expect(setItemPriority).toHaveBeenCalledWith(LIST_ID, ITEM_ID, 'low');
    expect(bulkExit).toHaveBeenCalled();
  });

  it('handlePickerCancel closes the move/copy picker', () => {
    const { handleOpenMoveCopy, handlePickerCancel, pickerOpen } = setup();
    handleOpenMoveCopy(sampleItem());
    handlePickerCancel();
    expect(pickerOpen.value).toBe(false);
  });

  it('records picker errors when copy fails', async () => {
    vi.mocked(copyItem).mockRejectedValueOnce(new Error('copy failed'));
    const { handleOpenMoveCopy, handlePickerCopy, pickerError } = setup();
    handleOpenMoveCopy(sampleItem());
    await handlePickerCopy(OTHER_LIST);
    expect(pickerError.value).toBe('copy failed');
  });

  it('skips picker copy when there is no authenticated user', async () => {
    useAuthStore().user = null;
    const { handleOpenMoveCopy, handlePickerCopy } = setup();
    handleOpenMoveCopy(sampleItem());
    await handlePickerCopy(OTHER_LIST);
    expect(copyItem).not.toHaveBeenCalled();
  });

  it('closes bulk paste when rows are empty', async () => {
    const { handleBulkPasteSubmit, bulkPasteOpen } = setup();
    bulkPasteOpen.value = true;
    await handleBulkPasteSubmit([]);
    expect(bulkAddItems).not.toHaveBeenCalled();
    expect(bulkPasteOpen.value).toBe(false);
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

  it('inferCategoryForBulk delegates to the catalog store', () => {
    const { inferCategoryForBulk } = setup();
    expect(inferCategoryForBulk('Bananas')).toBe('other');
  });

  it('no-ops remove and save handlers when prerequisites are missing', async () => {
    const { handleRemoveItem, confirmRemove, handleEditSave, undoItemDelete } = setup();
    handleRemoveItem('01ITEM000000000000000099' as ULID);
    await confirmRemove();
    expect(undoItemDelete.schedule).not.toHaveBeenCalled();
    await handleEditSave({
      name: 'X',
      quantity: '',
      note: '',
      category: 'other',
      pinned: false,
    });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('closeDontSuggest clears the dont-suggest modal', () => {
    const { closeDontSuggest, dontSuggestCandidate } = setup();
    dontSuggestCandidate.value = {
      name: 'X',
      entryId: '01CAT00000000000000000001' as ULID,
    };
    closeDontSuggest();
    expect(dontSuggestCandidate.value).toBeNull();
  });

  it('handlePrioritySelect no-ops when no item is selected', async () => {
    const { handlePrioritySelect } = setup();
    await handlePrioritySelect('high');
    expect(setItemPriority).not.toHaveBeenCalled();
  });
});
