import { ref, computed, type ComputedRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHaptic } from '@/composables/useHaptic';
import { useUndoDelete } from '@/composables/useUndoDelete';
import { useBulkSelection } from '@/composables/useBulkSelection';
import { useAuthStore } from '@/stores/auth';
import { useItemsStore } from '@/stores/items';
import { useCatalogStore } from '@/stores/catalog';
import { useListFavoritesStore } from '@/stores/listFavorites';
import {
  addItem,
  bulkAddItems,
  toggleChecked,
  removeItem,
  emptyList,
  updateItem,
  setItemPriority,
  copyItem,
  moveItem,
  bulkRemoveItems,
  bulkCopyItems,
  bulkMoveItems,
} from '@/services/items.service';
import {
  setListFavoriteExcluded,
  setListFavoriteState,
  findListFavoriteByName,
  ensureListFavorite,
  patchListFavorite,
} from '@/services/listFavorites.service';
import { recordListHistory } from '@/services/history.service';
import {
  clearListHistoryRecorded,
  markListHistoryRecorded,
  wasListHistoryRecorded,
} from '@/domain/listHistoryCycle';
import { capitalizeInitial } from '@/domain/text';
import {
  deleteCatalogEntry,
  findCatalogEntryByName,
  upsertCatalogEntry,
} from '@/services/catalog.service';
import { uploadItemPhoto, removeItemPhoto } from '@/services/itemPhotos.service';
import { isCustomItemName } from '@/domain/public-catalog';
import { countUrgentItems } from '@/domain/priority';
import type { Category, Item, ItemPriority, ListFavoriteState } from '@/domain/types';
import type { ItemAddedVia } from '@/domain/itemProvenance';
import type { ULID } from '@/domain/id';

const FIRST_CHECK_FLAG = 'btw:tutorialFirstCheckSeen';

export interface ListDetailActionsDeps {
  listId: ComputedRef<ULID>;
  expandIfCollapsed: (category: Category) => void;
  /** Shared set tracking categories that were fully checked (auto-collapse). */
  previouslyAllChecked: Set<Category>;
}

/**
 * Item, favorite-shelf, bulk, and edit-sheet mutations for the list detail
 * view. Keeps Firestore/service calls out of the template orchestrator.
 */
export const useListDetailActions = (deps: ListDetailActionsDeps) => {
  const { listId, expandIfCollapsed, previouslyAllChecked } = deps;
  const { t, locale } = useI18n();
  const authStore = useAuthStore();
  const itemsStore = useItemsStore();
  const catalogStore = useCatalogStore();
  const listFavoritesStore = useListFavoritesStore();
  const { pulse } = useHaptic();
  const undoItemDelete = useUndoDelete();
  const bulkSel = useBulkSelection();

  const pinnedNames = computed<Set<string>>(() => listFavoritesStore.pinnedNames);

  // Edit sheet
  const editingItemId = ref<string | null>(null);
  const editingItem = computed<Item | null>(() => {
    const id = editingItemId.value;
    if (!id) return null;
    return itemsStore.items.find((i) => i.id === id) ?? null;
  });
  const editSheetOpen = computed(() => editingItem.value !== null);
  const editingPinned = ref(false);
  const photoBusy = ref(false);

  // Favorite shelf exclude modal
  const excludeCandidate = ref<ListFavoriteState | null>(null);
  const excludeModalOpen = computed(() => excludeCandidate.value !== null);

  // Single-item remove modal
  const removeCandidate = ref<Item | null>(null);
  const removeModalOpen = computed(() => removeCandidate.value !== null);

  // Move/copy picker (single item)
  const pickerItem = ref<Item | null>(null);
  const pickerOpen = computed(() => pickerItem.value !== null);
  const pickerBusy = ref(false);
  const pickerError = ref<string | null>(null);

  // Priority picker
  const priorityItem = ref<Item | null>(null);
  const priorityOpen = computed(() => priorityItem.value !== null);
  const bulkPriorityMode = ref(false);

  // Bulk picker
  const bulkPickerOpen = ref(false);
  const bulkPickerLabel = computed(() =>
    bulkSel.count.value > 0
      ? t('item.bulkSelectedCount', { n: bulkSel.count.value }, bulkSel.count.value)
      : '',
  );

  // Paste / voice / favorites sheets
  const bulkPasteOpen = ref(false);
  const voiceAddOpen = ref(false);
  const favoritesOpen = ref(false);

  // First-check tutorial toast
  const toggleToastOpen = ref(false);
  const toggleToastMessage = ref('');

  // Don't-suggest follow-up after custom item delete
  const dontSuggestCandidate = ref<{ name: string; entryId: ULID } | null>(null);

  const inferCategoryForBulk = (name: string): Category =>
    catalogStore.inferCategoryForName(name, locale.value);

  const selectedItemsSnapshot = (): Item[] => {
    const ids = new Set(bulkSel.snapshot());
    return itemsStore.items.filter((i) => ids.has(i.id));
  };

  const maybeShowFirstCheckTutorial = (markingBought: boolean): void => {
    if (!markingBought) return;
    try {
      if (localStorage.getItem(FIRST_CHECK_FLAG) === '1') return;
      localStorage.setItem(FIRST_CHECK_FLAG, '1');
    } catch {
      return;
    }
    toggleToastMessage.value = t('item.firstCheckTutorialToast');
    toggleToastOpen.value = false;
    void Promise.resolve().then(() => {
      toggleToastOpen.value = true;
    });
  };

  const handleAddItem = async (params: {
    name: string;
    category: Category;
    quantity: string;
    note: string;
  }): Promise<void> => {
    if (!authStore.user) return;
    try {
      await addItem({
        listId: listId.value,
        name: params.name,
        quantity: params.quantity,
        category: params.category,
        note: params.note,
        createdByUid: authStore.user.uid,
        addedVia: 'autocomplete',
      });
      expandIfCollapsed(params.category);
      previouslyAllChecked.delete(params.category);
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] addItem failed:', err);
    }
  };

  const handleToggleChecked = async (itemId: ULID, checked: boolean): Promise<void> => {
    try {
      await toggleChecked(listId.value, itemId, checked);
      pulse();
      maybeShowFirstCheckTutorial(checked);
    } catch (err) {
      console.error('[useListDetailActions] toggleChecked failed:', err);
    }
  };

  const handleRemoveItem = (itemId: ULID): void => {
    const item = itemsStore.items.find((i) => i.id === itemId);
    if (!item) return;
    removeCandidate.value = item;
  };

  const cancelRemove = (): void => {
    removeCandidate.value = null;
  };

  const closeDontSuggest = (): void => {
    dontSuggestCandidate.value = null;
  };

  const maybeOfferDontSuggest = async (removedName: string): Promise<void> => {
    if (!authStore.user) return;
    if (!isCustomItemName(removedName, locale.value)) return;
    try {
      const entry = await findCatalogEntryByName(authStore.user.uid, removedName);
      if (!entry) return;
      dontSuggestCandidate.value = { name: removedName, entryId: entry.id };
    } catch (err) {
      console.warn('[useListDetailActions] dont-suggest lookup failed:', err);
    }
  };

  const handleDontSuggestConfirm = async (): Promise<void> => {
    const target = dontSuggestCandidate.value;
    closeDontSuggest();
    if (!target || !authStore.user) return;
    try {
      await deleteCatalogEntry(authStore.user.uid, target.entryId);
      const fav = await findListFavoriteByName(listId.value, target.name);
      if (fav) {
        await setListFavoriteState(listId.value, fav.slug, false);
      }
    } catch (err) {
      console.error('[useListDetailActions] dont-suggest delete failed:', err);
    }
  };

  const confirmRemove = async (): Promise<void> => {
    const target = removeCandidate.value;
    removeCandidate.value = null;
    if (!target) return;
    itemsStore.markPendingDelete(target.id);
    pulse();
    undoItemDelete.schedule({
      id: target.id,
      message: t('item.deletedWithUndo'),
      commit: async () => {
        try {
          await removeItem(listId.value, target.id);
          void maybeOfferDontSuggest(target.name);
        } catch (err) {
          console.error('[useListDetailActions] removeItem failed:', err);
        } finally {
          itemsStore.unmarkPendingDelete(target.id);
        }
      },
      onUndo: () => {
        itemsStore.unmarkPendingDelete(target.id);
      },
    });
  };

  const handleEmptyList = async (scope: 'all' | 'checked' = 'all'): Promise<void> => {
    const items = itemsStore.items;
    const targets = scope === 'checked' ? items.filter((i) => i.checked) : items;
    const ids = targets.map((i) => i.id);
    if (ids.length === 0) return;
    const uid = authStore.user?.uid;
    const historyItems = scope === 'checked' ? targets : items;
    try {
      if (
        uid &&
        historyItems.length > 0 &&
        !wasListHistoryRecorded(listId.value)
      ) {
        await recordListHistory(listId.value, historyItems, uid, 'empty_fallback');
        markListHistoryRecorded(listId.value);
      }
      await emptyList(listId.value, ids, { urgentRemoved: countUrgentItems(targets) });
      if (ids.length === items.length) {
        clearListHistoryRecorded(listId.value);
      }
    } catch (err) {
      console.error('[useListDetailActions] emptyList failed:', err);
    }
  };

  const handleSelectEnter = (item: Item): void => {
    bulkSel.enter(item.id);
  };

  const handleSelectToggle = (item: Item): void => {
    bulkSel.toggle(item.id);
  };

  const cancelBulkSelection = (): void => bulkSel.exit();

  const handleBulkDelete = async (): Promise<void> => {
    const targets = selectedItemsSnapshot();
    if (targets.length === 0) return;
    for (const it of targets) itemsStore.markPendingDelete(it.id);
    const targetIds = targets.map((i) => i.id);
    bulkSel.exit();
    pulse();
    undoItemDelete.schedule({
      id: targetIds.join(','),
      message: t('item.bulkDeletedWithUndo', { n: targets.length }, targets.length),
      durationMs: 3000,
      commit: async () => {
        try {
          await bulkRemoveItems(listId.value, targetIds, {
            urgentRemoved: countUrgentItems(targets),
          });
        } catch (err) {
          console.error('[useListDetailActions] bulkRemoveItems failed:', err);
        } finally {
          for (const id of targetIds) itemsStore.unmarkPendingDelete(id);
        }
      },
      onUndo: () => {
        for (const id of targetIds) itemsStore.unmarkPendingDelete(id);
      },
    });
  };

  const handleBulkPriority = (): void => {
    const targets = selectedItemsSnapshot();
    if (targets.length === 0) return;
    priorityItem.value = { ...targets[0] };
    bulkPriorityMode.value = true;
  };

  const openBulkPicker = (_mode: 'move' | 'copy'): void => {
    if (bulkSel.count.value === 0) return;
    bulkPickerOpen.value = true;
  };

  const closeBulkPicker = (): void => {
    bulkPickerOpen.value = false;
  };

  const handleBulkPickerMove = async (dstListId: ULID): Promise<void> => {
    if (!authStore.user) return;
    const targets = selectedItemsSnapshot();
    closeBulkPicker();
    bulkSel.exit();
    if (targets.length === 0) return;
    try {
      await bulkMoveItems(listId.value, targets, dstListId, authStore.user.uid);
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] bulkMoveItems failed:', err);
    }
  };

  const handleBulkPickerCopy = async (dstListId: ULID): Promise<void> => {
    if (!authStore.user) return;
    const targets = selectedItemsSnapshot();
    closeBulkPicker();
    bulkSel.exit();
    if (targets.length === 0) return;
    try {
      await bulkCopyItems(targets, dstListId, authStore.user.uid);
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] bulkCopyItems failed:', err);
    }
  };

  const handleRequestPriority = (item: Item): void => {
    priorityItem.value = item;
  };

  const handlePrioritySelect = async (p: ItemPriority | null): Promise<void> => {
    const item = priorityItem.value;
    priorityItem.value = null;
    if (bulkPriorityMode.value) {
      bulkPriorityMode.value = false;
      const targets = bulkSel.snapshot();
      bulkSel.exit();
      pulse();
      await Promise.all(targets.map((id) => setItemPriority(listId.value, id, p)));
    } else {
      if (!item) return;
      try {
        await setItemPriority(listId.value, item.id, p);
        pulse();
      } catch (err) {
        console.error('[useListDetailActions] setItemPriority failed:', err);
      }
    }
  };

  const handlePriorityCancel = (): void => {
    priorityItem.value = null;
    bulkPriorityMode.value = false;
  };

  const handleTogglePinned = async (item: Item): Promise<void> => {
    try {
      const slug = await ensureListFavorite(listId.value, item.name, item.category);
      const currentlyFavorite = pinnedNames.value.has(item.name);
      await setListFavoriteState(listId.value, slug, !currentlyFavorite);
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] togglePinned failed:', err);
    }
  };

  const handleOpenMoveCopy = (item: Item): void => {
    pickerError.value = null;
    pickerItem.value = item;
  };

  const handlePickerCancel = (): void => {
    pickerItem.value = null;
    pickerError.value = null;
  };

  const handlePickerCopy = async (dstListId: ULID): Promise<void> => {
    if (!pickerItem.value || !authStore.user) return;
    const item = pickerItem.value;
    pickerBusy.value = true;
    pickerError.value = null;
    try {
      await copyItem(item, dstListId, authStore.user.uid);
      pickerItem.value = null;
      pulse();
    } catch (err) {
      pickerError.value = err instanceof Error ? err.message : String(err);
    } finally {
      pickerBusy.value = false;
    }
  };

  const handlePickerMove = async (dstListId: ULID): Promise<void> => {
    if (!pickerItem.value || !authStore.user) return;
    const item = pickerItem.value;
    pickerBusy.value = true;
    pickerError.value = null;
    try {
      await moveItem(listId.value, item, dstListId, authStore.user.uid);
      pickerItem.value = null;
      pulse();
    } catch (err) {
      pickerError.value = err instanceof Error ? err.message : String(err);
    } finally {
      pickerBusy.value = false;
    }
  };

  const handleOpenItemEdit = async (item: Item): Promise<void> => {
    editingItemId.value = item.id;
    editingPinned.value = pinnedNames.value.has(item.name);
  };

  const handleEditCancel = (): void => {
    editingItemId.value = null;
  };

  const handleEditUploadPhoto = async (item: Item, file: File): Promise<void> => {
    photoBusy.value = true;
    try {
      await uploadItemPhoto(listId.value, item.id, file);
    } catch (err) {
      console.error('[useListDetailActions] uploadItemPhoto failed:', err);
    } finally {
      photoBusy.value = false;
    }
  };

  const handleEditRemovePhoto = async (item: Item): Promise<void> => {
    photoBusy.value = true;
    try {
      await removeItemPhoto(listId.value, item.id);
    } catch (err) {
      console.error('[useListDetailActions] removeItemPhoto failed:', err);
    } finally {
      photoBusy.value = false;
    }
  };

  const handleEditSave = async (patch: {
    name: string;
    quantity: string;
    note: string;
    category: Category;
    pinned: boolean;
  }): Promise<void> => {
    if (!editingItem.value || !authStore.user) return;
    const id = editingItem.value.id;
    const itemName = editingItem.value.name;
    const previousCategory = editingItem.value.category;
    const previousPinned = editingPinned.value;
    const uid = authStore.user.uid;
    editingItemId.value = null;
    try {
      await updateItem(listId.value, id, {
        name: patch.name,
        quantity: patch.quantity,
        note: patch.note,
        category: patch.category,
      });
      if (patch.category !== previousCategory) {
        await upsertCatalogEntry(uid, capitalizeInitial(patch.name), patch.category);
      }
      const fav = await findListFavoriteByName(listId.value, itemName);
      if (fav) {
        await patchListFavorite(listId.value, fav.slug, {
          name: capitalizeInitial(patch.name),
          category: patch.category,
        });
      }
      // Pin toggled from the edit sheet: persist it even when no favorite
      // record exists yet (mirrors the row-star path via ensureListFavorite),
      // otherwise pinning a never-favorited item would silently no-op.
      if (patch.pinned !== previousPinned) {
        const slug = fav
          ? fav.slug
          : await ensureListFavorite(listId.value, patch.name, patch.category);
        await setListFavoriteState(listId.value, slug, patch.pinned);
      }
    } catch (err) {
      console.error('[useListDetailActions] updateItem failed:', err);
    }
  };

  const handleShelfExclude = (entry: ListFavoriteState): void => {
    excludeCandidate.value = entry;
  };

  const cancelExclude = (): void => {
    excludeCandidate.value = null;
  };

  const confirmExclude = async (): Promise<void> => {
    const target = excludeCandidate.value;
    excludeCandidate.value = null;
    if (!target) return;
    try {
      await setListFavoriteExcluded(listId.value, target.slug, true);
    } catch (err) {
      console.error('[useListDetailActions] exclude favorite failed:', err);
    }
  };

  const handleShelfAdd = async (entry: ListFavoriteState): Promise<void> => {
    if (!authStore.user) return;
    try {
      await addItem({
        listId: listId.value,
        name: entry.name,
        quantity: '',
        category: entry.category,
        note: '',
        createdByUid: authStore.user.uid,
        addedVia: 'favorite',
      });
      expandIfCollapsed(entry.category);
      previouslyAllChecked.delete(entry.category);
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] shelf addItem failed:', err);
    }
  };

  const openBulkPaste = (): void => {
    bulkPasteOpen.value = true;
  };

  const closeBulkPaste = (): void => {
    bulkPasteOpen.value = false;
  };

  const openVoiceAdd = (): void => {
    voiceAddOpen.value = true;
  };

  const closeVoiceAdd = (): void => {
    voiceAddOpen.value = false;
  };

  const openFavorites = (): void => {
    favoritesOpen.value = true;
  };

  const closeFavorites = (): void => {
    favoritesOpen.value = false;
  };

  const handleBulkPasteSubmit = async (
    rows: Array<{ name: string; category: Category }>,
    addedVia: ItemAddedVia = 'bulk',
  ): Promise<void> => {
    if (!authStore.user || rows.length === 0) {
      bulkPasteOpen.value = false;
      return;
    }
    try {
      await bulkAddItems({
        listId: listId.value,
        rows: rows.map((r) => ({ name: r.name, category: r.category })),
        createdByUid: authStore.user.uid,
        addedVia,
      });
      const seenCats = new Set<Category>();
      for (const r of rows) {
        if (!seenCats.has(r.category)) {
          expandIfCollapsed(r.category);
          previouslyAllChecked.delete(r.category);
          seenCats.add(r.category);
        }
      }
      pulse();
    } catch (err) {
      console.error('[useListDetailActions] bulkAddItems failed:', err);
    } finally {
      bulkPasteOpen.value = false;
    }
  };

  const handleVoiceAddSubmit = async (
    rows: Array<{ name: string; category: Category }>,
  ): Promise<void> => {
    voiceAddOpen.value = false;
    await handleBulkPasteSubmit(rows, 'voice');
  };

  return {
    bulkSel,
    undoItemDelete,
    inferCategoryForBulk,
    closeDontSuggest,
    pinnedNames,
    // Edit sheet
    editingItem,
    editSheetOpen,
    editingPinned,
    photoBusy,
    handleOpenItemEdit,
    handleEditCancel,
    handleEditUploadPhoto,
    handleEditRemovePhoto,
    handleEditSave,
    // Shelf
    handleShelfExclude,
    excludeCandidate,
    excludeModalOpen,
    cancelExclude,
    confirmExclude,
    handleShelfAdd,
    // Remove
    removeCandidate,
    removeModalOpen,
    cancelRemove,
    confirmRemove,
    handleRemoveItem,
    // Picker
    pickerItem,
    pickerOpen,
    pickerBusy,
    pickerError,
    handleOpenMoveCopy,
    handlePickerCancel,
    handlePickerCopy,
    handlePickerMove,
    // Priority
    priorityItem,
    priorityOpen,
    handleRequestPriority,
    handlePrioritySelect,
    handlePriorityCancel,
    // Bulk
    bulkPickerOpen,
    bulkPickerLabel,
    openBulkPicker,
    closeBulkPicker,
    handleBulkPickerMove,
    handleBulkPickerCopy,
    handleSelectEnter,
    handleSelectToggle,
    cancelBulkSelection,
    handleBulkDelete,
    handleBulkPriority,
    // Core item ops
    handleAddItem,
    handleToggleChecked,
    handleEmptyList,
    // Sheets
    bulkPasteOpen,
    voiceAddOpen,
    favoritesOpen,
    openBulkPaste,
    closeBulkPaste,
    openVoiceAdd,
    closeVoiceAdd,
    openFavorites,
    closeFavorites,
    handleBulkPasteSubmit,
    handleVoiceAddSubmit,
    handleTogglePinned,
    // Toasts / modals
    toggleToastOpen,
    toggleToastMessage,
    dontSuggestCandidate,
    handleDontSuggestConfirm,
  };
};
