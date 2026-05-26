<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useHaptic } from '@/composables/useHaptic';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useAuthStore } from '@/stores/auth';
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
} from '@/services/listFavorites.service';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { CATEGORIES } from '@/domain/categories';
import { isCustomItemName } from '@/domain/public-catalog';
import { sortCategoriesWithPreference } from '@/domain/sort';
import { useCollapsedCategories } from '@/composables/useCollapsedCategories';
import { ArrowLeft, Settings as SettingsIcon, Share2, ClipboardPaste, Mic } from '@lucide/vue';
import { getUsersByUids } from '@/services/users.service';
import { notifyListEvent } from '@/services/notify.service';
import { useSafeBack } from '@/composables/useSafeBack';
import { useUndoDelete } from '@/composables/useUndoDelete';
import { useBulkSelection } from '@/composables/useBulkSelection';
import { VueDraggable } from 'vue-draggable-plus';
import { setListCategoryOrder } from '@/services/lists.service';
import { Undo2, X as XIcon, Trash2 as Trash2Icon, ArrowRightLeft as MoveIcon, Flag as FlagIcon } from '@lucide/vue';
import type { UserProfile } from '@/domain/types';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import EmptyListButton from '@/components/list/EmptyListButton.vue';
import ItemEditSheet from '@/components/list/ItemEditSheet.vue';
import ListPickerSheet from '@/components/list/ListPickerSheet.vue';
import PriorityPickerSheet from '@/components/list/PriorityPickerSheet.vue';
import BulkPasteSheet from '@/components/list/BulkPasteSheet.vue';
import VoiceAddSheet from '@/components/list/VoiceAddSheet.vue';
import CompletionCelebration from '@/components/ui/CompletionCelebration.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import Toast from '@/components/ui/Toast.vue';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import {
  deleteCatalogEntry,
  findCatalogEntryByName,
} from '@/services/catalog.service';
import { uploadItemPhoto, removeItemPhoto } from '@/services/itemPhotos.service';
import type { Category, Item, ItemPriority, ListFavoriteState } from '@/domain/types';
import type { ULID } from '@/domain/id';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();
const itemsStore = useItemsStore();
const authStore = useAuthStore();
const catalogStore = useCatalogStore();
const listFavoritesStore = useListFavoritesStore();

const listId = computed(() => route.params.id as ULID);
const list = computed(() => listsStore.lists.find((l) => l.id === listId.value));
const itemsByCategory = computed<[Category, Item[]][]>(() => {
  const map = itemsStore.itemsByCategory;
  const present = [...map.keys()];
  // Per-list preferred ordering (admin-set drag-and-drop) wins; unfamiliar
  // categories tail-append in alphabetic order so newly-introduced
  // categories never disappear when the preferred order pre-dates them.
  const sorted = sortCategoriesWithPreference(
    present,
    list.value?.categoryOrder,
    (c) => t(CATEGORIES[c].labelKey),
    locale.value,
  );
  return sorted.map((c) => [c, map.get(c)!] as [Category, Item[]]);
});
// S3.1: count from visibleItems (excludes pending-delete buffer) so the
// header counters reflect what the user sees, not the raw firestore snapshot.
const hasItems = computed(() => itemsStore.visibleItems.length > 0);
const shelfEntries = computed(() => listFavoritesStore.rankedEntries);
const shelfTopSlugs = computed<Set<string>>(
  () => new Set(listFavoritesStore.rankedEntries.slice(0, 2).map((e) => e.slug)),
);
const itemCount = computed(() => itemsStore.visibleItems.length);
const boughtCount = computed(() => itemsStore.visibleItems.filter((i) => i.checked).length);
const usersCount = computed(() => list.value?.collaboratorUids.length ?? 0);

// Category-reorder is intentionally open to every collaborator (shared
// per-list ordering, mirrors itemCount writes). The firestore rule mirrors
// this on the server.
const canReorderCategories = computed(() =>
  authStore.user
    ? (list.value?.collaboratorUids ?? []).includes(authStore.user.uid)
    : false,
);

// VueDraggable mutates an internal copy. We surface the model via a getter
// that always reflects the latest derived order; writes are ignored - the
// `@end` handler computes the new order and persists it instead.
const draggableCategoryPairs = computed<[Category, Item[]][]>({
  get: () => itemsByCategory.value,
  set: () => {
    // No-op: order persisted server-side via onCategoryReorder.
  },
});

interface CategorySortableEvent {
  oldIndex?: number;
  newIndex?: number;
}

const onCategoryReorder = async (e: CategorySortableEvent): Promise<void> => {
  if (!canReorderCategories.value) return;
  const { oldIndex, newIndex } = e;
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
  const current = itemsByCategory.value.map(([c]) => c);
  if (newIndex < 0 || newIndex >= current.length) return;
  const moved = current[oldIndex];
  if (!moved) return;
  const post = [...current];
  post.splice(oldIndex, 1);
  post.splice(newIndex, 0, moved);
  try {
    await setListCategoryOrder(listId.value, post);
  } catch (err) {
    console.warn('[ListDetailView] setListCategoryOrder failed:', err);
  }
};

// Collaborator avatars (loaded lazily as list resolves)
const profileMap = ref<Map<string, UserProfile>>(new Map());
const collaboratorUids = computed<readonly string[]>(
  () => list.value?.collaboratorUids ?? [],
);
const loadProfiles = async (uids: readonly string[]): Promise<void> => {
  const missing = uids.filter((u) => !profileMap.value.has(u));
  if (missing.length === 0) return;
  try {
    const profiles = await getUsersByUids(missing);
    const next = new Map(profileMap.value);
    for (const p of profiles) next.set(p.uid, p);
    profileMap.value = next;
  } catch (err) {
    console.warn('[ListDetailView] loadProfiles failed:', err);
  }
};
watch(
  collaboratorUids,
  (uids) => {
    if (uids.length > 0) void loadProfiles(uids);
  },
  { immediate: true },
);

const MAX_AVATARS = 4;
const visibleMembers = computed<UserProfile[]>(() =>
  collaboratorUids.value
    .map((u) => profileMap.value.get(u))
    .filter((p): p is UserProfile => Boolean(p))
    .slice(0, MAX_AVATARS),
);
const overflowMembersCount = computed(() =>
  Math.max(0, collaboratorUids.value.length - MAX_AVATARS),
);
const initialFor = (m: UserProfile): string => {
  const source = m.displayName.trim() || m.email;
  return source.charAt(0).toUpperCase();
};
const avatarColorFor = (uid: string): string => {
  // Mirror the ListCard palette so the same uid yields the same hue across
  // both views. Dark variants invert chip/ink for WCAG AA contrast.
  const palette = [
    'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
    'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
    'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
    'bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
    'bg-pink-200 text-pink-900 dark:bg-pink-900 dark:text-pink-100',
    'bg-lime-200 text-lime-900 dark:bg-lime-900 dark:text-lime-100',
    'bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100',
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
};

// Updated-at label (same format used in ListCard for consistency).
const updatedDateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      year:
        list.value && new Date(list.value.updatedAt).getFullYear() === new Date().getFullYear()
          ? undefined
          : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
);
const updatedLabel = computed(() =>
  list.value ? updatedDateFormatter.value.format(new Date(list.value.updatedAt)) : '',
);

const autocompleteActive = ref(false);

const safeBack = useSafeBack();
const handleBack = (): void => safeBack({ name: 'lists' });

const shareToastOpen = ref(false);
const shareToastMessage = ref('');

const formatListForSharing = (): string => {
  if (!list.value) return '';
  const lines: string[] = [];
  lines.push(t('list.shareTitle', { name: list.value.name }));
  lines.push('');

  for (const [cat, items] of itemsByCategory.value) {
    const toBuy = items.filter(i => !i.checked);
    if (toBuy.length === 0) continue;

    const catLabel = t(CATEGORIES[cat].labelKey);
    const catIcon = CATEGORIES[cat].icon;
    lines.push(`${catIcon} ${catLabel}`);

    for (const item of toBuy) {
      let line = `• ${item.name}`;
      if (item.quantity) {
        line += ` - ${t('item.quantity')}: ${item.quantity}`;
      }
      if (item.note) {
        line += ` - ${t('list.shareNoteLabel')}: ${item.note}`;
      }
      lines.push(line);
    }
    lines.push('');
  }

  lines.push(t('list.shareFooter'));
  return lines.join('\n');
};

const handleShareList = async (): Promise<void> => {
  const text = formatListForSharing();
  if (!text) return;

  try {
    if (navigator.share) {
      await navigator.share({
        text: text,
      });
    } else {
      await navigator.clipboard.writeText(text);
      shareToastMessage.value = t('list.shareCopied');
      shareToastOpen.value = true;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    console.error('[ListDetailView] Error sharing list:', error);
    shareToastMessage.value = t('list.shareError');
    shareToastOpen.value = true;
  }
};

const celebrationKey = ref(0);
const wasComplete = ref(false);
// Armed once we observe a non-complete state with items present - prevents
// celebrating on initial load when a list happens to already be all-checked.
const everHadIncompleteItems = ref(false);
watch(
  [itemCount, boughtCount],
  ([items, bought]) => {
    const complete = items > 0 && bought === items;
    if (!complete && items > 0) everHadIncompleteItems.value = true;
    if (complete && !wasComplete.value && everHadIncompleteItems.value) {
      celebrationKey.value += 1;
    }
    wasComplete.value = complete;
  },
  { immediate: false },
);

const { isCollapsed, toggle: toggleCollapsed, expandIfCollapsed } = useCollapsedCategories(
  computed(() => String(listId.value)),
);

const editingItemId = ref<string | null>(null);
const editingItem = computed<Item | null>(() => {
  const id = editingItemId.value;
  if (!id) return null;
  return itemsStore.items.find((i) => i.id === id) ?? null;
});
const editSheetOpen = computed(() => editingItem.value !== null);
const editingPinned = ref(false);
const photoBusy = ref(false);

const excludeCandidate = ref<ListFavoriteState | null>(null);
const excludeModalOpen = computed(() => excludeCandidate.value !== null);

const removeCandidate = ref<Item | null>(null);
const removeModalOpen = computed(() => removeCandidate.value !== null);

const pickerItem = ref<Item | null>(null);
const pickerOpen = computed(() => pickerItem.value !== null);
const pickerBusy = ref(false);
const pickerError = ref<string | null>(null);
const otherLists = computed(() =>
  listsStore.lists.filter((l) => l.id !== listId.value),
);
const canMoveCopy = computed(() => otherLists.value.length > 0);

const priorityItem = ref<Item | null>(null);
const priorityOpen = computed(() => priorityItem.value !== null);

const pinnedNames = computed<Set<string>>(() => listFavoritesStore.pinnedNames);

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
      console.error('[ListDetailView] setItemPriority failed:', err);
    }
  }
};

const handlePriorityCancel = (): void => {
  priorityItem.value = null;
  bulkPriorityMode.value = false;
};

const handleTogglePinned = async (item: Item): Promise<void> => {
  try {
    // Guarantee a favoriteState doc exists before flipping flags. Covers the
    // case where the row's row predates per-list favorites or the doc was
    // never created (defensive - addItem upserts, but legacy lists won't).
    const slug = await ensureListFavorite(listId.value, item.name, item.category);
    const currentlyFavorite = pinnedNames.value.has(item.name);
    await setListFavoriteState(listId.value, slug, !currentlyFavorite);
    pulse();
  } catch (err) {
    console.error('[ListDetailView] togglePinned failed:', err);
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

const { pulse } = useHaptic();

const previouslyAllChecked = new Set<Category>();

watch(
  () => itemsStore.itemsByCategory,
  (map) => {
    for (const [cat, items] of map.entries()) {
      const allCheckedNow = items.length > 0 && items.every((i) => i.checked);
      const wasAllChecked = previouslyAllChecked.has(cat);
      if (allCheckedNow && !wasAllChecked) {
        previouslyAllChecked.add(cat);
        if (!isCollapsed(cat)) toggleCollapsed(cat);
      } else if (!allCheckedNow && wasAllChecked) {
        previouslyAllChecked.delete(cat);
      }
    }
  },
  { deep: true },
);

const handleOpenItemEdit = async (item: Item): Promise<void> => {
  editingItemId.value = item.id;
  // Per-list favorite shelf state already lives in the local store - no
  // round-trip needed. The shelf pinnedNames set is the authoritative source.
  editingPinned.value = pinnedNames.value.has(item.name);
};

const handleEditCancel = (): void => {
  editingItemId.value = null;
};

// S4.2: photo upload/remove. We DON'T close the edit sheet on upload so the
// user immediately sees the thumbnail land in place; remove keeps the same
// behavior. Failures surface in the console but don't surface a UI toast
// today (could be added once we have a per-item busy state).
const handleEditUploadPhoto = async (item: Item, file: File): Promise<void> => {
  photoBusy.value = true;
  try {
    await uploadItemPhoto(listId.value, item.id, file);
  } catch (err) {
    console.error('[ListDetailView] uploadItemPhoto failed:', err);
  } finally {
    photoBusy.value = false;
  }
};
const handleEditRemovePhoto = async (item: Item): Promise<void> => {
  photoBusy.value = true;
  try {
    await removeItemPhoto(listId.value, item.id);
  } catch (err) {
    console.error('[ListDetailView] removeItemPhoto failed:', err);
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
  const previousPinned = editingPinned.value;
  editingItemId.value = null;
  try {
    await updateItem(listId.value, id, {
      name: patch.name,
      quantity: patch.quantity,
      note: patch.note,
      category: patch.category,
    });
    if (patch.pinned !== previousPinned) {
      const fav = await findListFavoriteByName(listId.value, itemName);
      if (fav) {
        await setListFavoriteState(listId.value, fav.slug, patch.pinned);
      }
    }
  } catch (err) {
    console.error('[ListDetailView] updateItem failed:', err);
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
    console.error('[ListDetailView] exclude favorite failed:', err);
  }
};

const handleShelfAdd = async (entry: ListFavoriteState) => {
  if (!authStore.user) return;
  try {
    await addItem({
      listId: listId.value,
      name: entry.name,
      quantity: '',
      category: entry.category,
      note: '',
      createdByUid: authStore.user.uid,
    });
    expandIfCollapsed(entry.category);
    previouslyAllChecked.delete(entry.category);
    pulse();
  } catch (err) {
    console.error('[ListDetailView] shelf addItem failed:', err);
  }
};

// Bulk paste sheet state.
const bulkPasteOpen = ref(false);

const openBulkPaste = (): void => {
  bulkPasteOpen.value = true;
};

const closeBulkPaste = (): void => {
  bulkPasteOpen.value = false;
};

const inferCategoryForBulk = (name: string): Category =>
  catalogStore.inferCategoryForName(name, locale.value);

// S3.3: voice input. Same sheet pattern as bulk paste; reuses the bulk-add
// handler so transcript → multi-item add inherits batching + atomicity.
const voiceAddOpen = ref(false);
const openVoiceAdd = (): void => {
  voiceAddOpen.value = true;
};
const closeVoiceAdd = (): void => {
  voiceAddOpen.value = false;
};
const handleVoiceAddSubmit = async (
  rows: Array<{ name: string; category: Category }>,
): Promise<void> => {
  voiceAddOpen.value = false;
  await handleBulkPasteSubmit(rows);
};

const handleBulkPasteSubmit = async (
  rows: Array<{ name: string; category: Category }>,
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
    });
    // Expand every touched category so the freshly-pasted rows are visible.
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
    console.error('[ListDetailView] bulkAddItems failed:', err);
  } finally {
    bulkPasteOpen.value = false;
  }
};

const handleAddItem = async (params: {
  name: string;
  category: Category;
  quantity: string;
  note: string;
}) => {
  if (!authStore.user) return;
  try {
    await addItem({
      listId: listId.value,
      name: params.name,
      quantity: params.quantity,
      category: params.category,
      note: params.note,
      createdByUid: authStore.user.uid,
    });
    expandIfCollapsed(params.category);
    previouslyAllChecked.delete(params.category);
    pulse();
  } catch (err) {
    console.error('[ListDetailView] addItem failed:', err);
  }
};

// One-shot tutorial toast: explain what tapping an item does, the first time
// the user marks an item as bought in this device's lifetime.
const FIRST_CHECK_FLAG = 'btw:tutorialFirstCheckSeen';
const toggleToastOpen = ref(false);
const toggleToastMessage = ref('');

const maybeShowFirstCheckTutorial = (markingBought: boolean): void => {
  if (!markingBought) return;
  try {
    if (localStorage.getItem(FIRST_CHECK_FLAG) === '1') return;
    localStorage.setItem(FIRST_CHECK_FLAG, '1');
  } catch {
    // Storage unavailable - skip the toast rather than fire it every time.
    return;
  }
  toggleToastMessage.value = t('item.firstCheckTutorialToast');
  toggleToastOpen.value = false;
  void Promise.resolve().then(() => {
    toggleToastOpen.value = true;
  });
};

const handleToggleChecked = async (itemId: ULID, checked: boolean) => {
  try {
    await toggleChecked(listId.value, itemId, checked);
    pulse();
    maybeShowFirstCheckTutorial(checked);
  } catch (err) {
    console.error('[ListDetailView] toggleChecked failed:', err);
  }
};


const handleRemoveItem = (itemId: ULID) => {
  const item = itemsStore.items.find((i) => i.id === itemId);
  if (!item) return;
  removeCandidate.value = item;
};

const cancelRemove = (): void => {
  removeCandidate.value = null;
};

// "Don't suggest again?" follow-up after a custom-item trash. Holds the
// candidate the user is being asked about; the template binds two
// ConfirmModal buttons - Don't-suggest = delete catalog entry, Continue =
// no-op (close).
const dontSuggestCandidate = ref<{ name: string; entryId: ULID } | null>(null);

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
    console.warn('[ListDetailView] dont-suggest lookup failed:', err);
  }
};

const handleDontSuggestConfirm = async (): Promise<void> => {
  const target = dontSuggestCandidate.value;
  closeDontSuggest();
  if (!target || !authStore.user) return;
  try {
    // Delete the per-user catalog entry so the item is no longer suggested in
    // autocomplete across any list.
    await deleteCatalogEntry(authStore.user.uid, target.entryId);

    // Also remove from this list's favorites if present.
    const fav = await findListFavoriteByName(listId.value, target.name);
    if (fav) {
      await setListFavoriteState(listId.value, fav.slug, false);
    }
  } catch (err) {
    console.error('[ListDetailView] dont-suggest delete failed:', err);
  }
};

// S3.1: undo-delete orchestrator. Owned by this view so the timer + the
// optimistic-hide buffer share a lifecycle (onBeforeUnmount flushes any
// in-flight delete so navigating away never silently swallows the action).
const undoItemDelete = useUndoDelete();

// S3.2: bulk selection mode + selected IDs.
const bulkSel = useBulkSelection();

const handleSelectEnter = (item: Item): void => {
  bulkSel.enter(item.id);
};
const handleSelectToggle = (item: Item): void => {
  bulkSel.toggle(item.id);
};
const cancelBulkSelection = (): void => bulkSel.exit();

const selectedItemsSnapshot = (): Item[] => {
  const ids = new Set(bulkSel.snapshot());
  return itemsStore.items.filter((i) => ids.has(i.id));
};

const handleBulkDelete = async (): Promise<void> => {
  const targets = selectedItemsSnapshot();
  if (targets.length === 0) return;
  // Optimistic hide via the same buffer S3.1 uses for single-item delete.
  for (const it of targets) itemsStore.markPendingDelete(it.id);
  const targetIds = targets.map((i) => i.id);
  bulkSel.exit();
  pulse();
  undoItemDelete.schedule({
    id: targetIds.join(','),
    message: t('item.bulkDeletedWithUndo', { n: targets.length }, targets.length),
    durationMs: 6000,
    commit: async () => {
      try {
        await bulkRemoveItems(listId.value, targetIds);
      } catch (err) {
        console.error('[ListDetailView] bulkRemoveItems failed:', err);
      } finally {
        for (const id of targetIds) itemsStore.unmarkPendingDelete(id);
      }
    },
    onUndo: () => {
      for (const id of targetIds) itemsStore.unmarkPendingDelete(id);
    },
  });
};


const bulkPriorityMode = ref(false);
const handleBulkPriority = (): void => {
  const targets = selectedItemsSnapshot();
  if (targets.length === 0) return;
  priorityItem.value = { ...targets[0] };
  bulkPriorityMode.value = true;
};

// Reuse the existing single-item picker sheet for bulk move/copy. The sheet
// emits `copy` or `move` per chosen destination; we dispatch to the matching
// bulk service here. A single `open` boolean is enough - the user picks the
// action per destination row inside the sheet.
const bulkPickerOpen = ref(false);
const bulkPickerLabel = computed(() =>
  bulkSel.count.value > 0
    ? t('item.bulkSelectedCount', { n: bulkSel.count.value }, bulkSel.count.value)
    : '',
);

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
    console.error('[ListDetailView] bulkMoveItems failed:', err);
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
    console.error('[ListDetailView] bulkCopyItems failed:', err);
  }
};

const confirmRemove = async (): Promise<void> => {
  const target = removeCandidate.value;
  removeCandidate.value = null;
  if (!target) return;
  // Hide optimistically: filter the row out of `visibleItems` BEFORE the
  // firestore call. Counter + section regroup react instantly; the user
  // sees the row disappear with no waiting on the network.
  itemsStore.markPendingDelete(target.id);
  pulse();
  undoItemDelete.schedule({
    id: target.id,
    message: t('item.deletedWithUndo'),
    durationMs: 5000,
    commit: async () => {
      try {
        await removeItem(listId.value, target.id);
        void maybeOfferDontSuggest(target.name);
      } catch (err) {
        console.error('[ListDetailView] removeItem failed:', err);
      } finally {
        // Whether the commit succeeded or failed, drop the buffer entry so
        // firestore is once again the single source of truth.
        itemsStore.unmarkPendingDelete(target.id);
      }
    },
    onUndo: () => {
      itemsStore.unmarkPendingDelete(target.id);
    },
  });
};

const handleEmptyList = async () => {
  const ids = itemsStore.items.map((i) => i.id);
  try {
    await emptyList(listId.value, ids);
  } catch (err) {
    console.error('[ListDetailView] emptyList failed:', err);
  }
};

let _listsUnsub: (() => void) | null = null;
let _favsUnsub: (() => void) | null = null;
let _catalogUnsub: (() => void) | null = null;

onMounted(() => {
  _listsUnsub = listsStore.subscribe();
  itemsStore.setCurrentList(listId.value);
  if (authStore.user) {
    _catalogUnsub = catalogStore.subscribe(authStore.user.uid);
  }
  _favsUnsub = listFavoritesStore.subscribe(listId.value);
  // Ensure profile is loaded so the stale-default cleanup below can compare
  // listId.value to authStore.profile.defaultListId.
  void authStore.ensureProfile();
  // Per-list NEW badge: load the user's per-list seen map, then mark THIS
  // list as seen. Runs in the background - the badge clears as soon as the
  // optimistic local update propagates to ListsView.
  //
  // First-view side-effect: if the user has never opened this list before
  // AND they're not the owner (i.e. they were invited), fan out a
  // `collaborator-joined` notification to the existing collaborators so
  // they see "Carol joined your list <name>" in their inbox. We wait for
  // the list snapshot to populate before reading ownerUid; the watcher
  // self-stops on first non-null tick.
  void (async () => {
    await listsStore.loadLastSeen();
    const seenBefore = listsStore.lastSeenListMap[listId.value] != null;
    if (!seenBefore && authStore.user) {
      const callerUid = authStore.user.uid;
      const stop = watch(
        () => list.value,
        (l) => {
          if (!l) return;
          nextTick(() => stop());
          if (l.ownerUid !== callerUid && l.collaboratorUids.includes(callerUid)) {
            void notifyListEvent({
              listId: listId.value,
              kind: 'collaborator-joined',
            });
          }
        },
        { immediate: true },
      );
    }
    await listsStore.markSeen(listId.value);
  })();
});

onUnmounted(() => {
  _listsUnsub?.();
  _favsUnsub?.();
  _catalogUnsub?.();
  itemsStore.setCurrentList(null);
  closeDontSuggest();
});

// Stale-default fallback: if the user is on the detail view for a list that
// no longer exists (deleted, or access revoked) AND that list was their
// default, clear the pref and bounce back to /lists. Covers the case where
// the boot redirect sent us into a deleted default list.
watch(
  [
    () => listsStore.initialized,
    () => listsStore.lists,
    () => authStore.profile,
  ],
  ([initialized, lists, profile]) => {
    // Wait until the Firestore subscription has delivered at least once -
    // an immediate fire with `lists=[]` would otherwise mistake "not loaded
    // yet" for "list deleted" and prematurely clear the default-list pref
    // (the exact bug that fired after refresh when the boot-redirect landed
    // here before the subscription delivered).
    if (!initialized) return;
    const exists = lists.some((l) => l.id === listId.value);
    if (exists) return;
    if (profile?.defaultListId === listId.value) {
      void authStore
        .setDefaultListId(null)
        .catch((err) => {
          console.warn('[ListDetailView] clear stale defaultListId failed:', err);
        })
        .finally(() => {
          void router.replace({ name: 'lists' });
        });
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="h-dvh bg-cream flex flex-col">
    <header class="px-5 pt-6 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="handleBack"
      >
        <ArrowLeft :size="22" :stroke-width="2.5" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate flex-1">
        {{ list?.name ?? '…' }}
      </h1>
      <button
        :aria-label="t('listSettings.title')"
        data-testid="open-list-settings"
        class="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.push({ name: 'list-settings', params: { id: listId } })"
      >
        <SettingsIcon :size="18" :stroke-width="2" aria-hidden="true" />
        <span class="text-sm font-medium">{{ t('listSettings.title') }}</span>
      </button>
    </header>

    <!-- Stats strip - two rows on every viewport: row 1 covers the at-a-glance
         counts (items / bought / users), row 2 reserves a dedicated line for
         the "updated" timestamp which would otherwise wrap awkwardly on
         narrow phones. -->
    <div
      v-if="list"
      data-testid="list-stats"
      class="px-5 pb-3 flex flex-col gap-y-1 text-xs text-muted-gray"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span data-testid="stat-items" class="inline-flex items-center gap-1">
            <span>{{ t('listSettings.stats.items') }}:</span>
            <span class="font-semibold text-charcoal">{{ itemCount }}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span data-testid="stat-bought" class="inline-flex items-center gap-1">
            <span>{{ t('listSettings.stats.bought') }}:</span>
            <span class="font-semibold text-charcoal tabular-nums">{{ boughtCount }}/{{ itemCount }}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
          data-testid="stat-users"
          class="inline-flex items-center gap-1"
          :aria-label="t('listSettings.stats.users') + ': ' + usersCount"
        >
          <span>{{ t('listSettings.stats.users') }}:</span>
          <span v-if="visibleMembers.length > 0" class="flex -space-x-1.5">
            <span
              v-for="m in visibleMembers"
              :key="m.uid"
              :title="m.displayName || m.email"
              :data-testid="`stat-avatar-${m.uid}`"
              :class="[
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold border border-cream overflow-hidden',
                m.photoURL ? 'bg-offwhite text-charcoal' : avatarColorFor(m.uid),
              ]"
            >
              <img
                v-if="m.photoURL"
                :src="m.photoURL"
                alt=""
                referrerpolicy="no-referrer"
                loading="lazy"
                width="20"
                height="20"
                class="w-full h-full object-cover"
              />
              <template v-else>{{ initialFor(m) }}</template>
            </span>
            <span
              v-if="overflowMembersCount > 0"
              class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold bg-cream-soft text-charcoal border border-cream"
            >
              +{{ overflowMembersCount }}
            </span>
          </span>
          <span v-else class="font-semibold text-charcoal">{{ usersCount }}</span>
        </span>
        </div>

        <button
          v-if="itemCount > 0"
          :aria-label="t('list.share')"
          data-testid="share-list"
          class="inline-flex items-center justify-center w-8 h-8 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10 transition-colors"
          @click="handleShareList"
        >
          <Share2 :size="14" :stroke-width="2.5" aria-hidden="true" />
        </button>
      </div>
      <span
        data-testid="stat-updated"
        class="inline-flex items-center gap-1"
      >
        <span>{{ t('listSettings.stats.updated') }}:</span>
        <span class="font-semibold text-charcoal">{{ updatedLabel }}</span>
      </span>
    </div>

    <!-- Sticky autocomplete row: input on the left, bulk-paste affordance on
         the right. shrink-0 prevents the flex parent from squeezing this
         block when the items list grows. Padding (px-5, py-2) lives on this
         wrapper so the input keeps its visual gutter symmetric with the
         button on the right edge of the row. -->
    <div class="px-5 py-2 shrink-0 flex items-center gap-2">
      <ItemAutocomplete
        class="flex-1 min-w-0"
        @add-item="handleAddItem"
        @active-change="(v) => (autocompleteActive = v)"
      />
      <button
        type="button"
        :aria-label="t('item.voiceAdd')"
        data-testid="open-voice-add"
        class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10 transition-colors"
        @click="openVoiceAdd"
      >
        <Mic :size="18" :stroke-width="2.25" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-label="t('item.bulkPaste')"
        data-testid="open-bulk-paste"
        class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10 transition-colors"
        @click="openBulkPaste"
      >
        <ClipboardPaste :size="18" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </div>

    <!-- Scrollable item list region. `min-h-0` is required for the flex
         child to shrink below its intrinsic content height so the inner
         overflow-y-auto can actually scroll instead of pushing the parent.
         The favorites shelf scrolls with the items - only the header /
         stats / autocomplete stay pinned at the top. -->
    <div
      data-testid="list-items-scroll"
      class="flex-1 min-h-0 overflow-y-auto pb-4"
    >
      <MostUsedShelf
        v-if="list?.showFavorites !== false"
        :entries="shelfEntries"
        :top-slugs="shelfTopSlugs"
        @add-from-shelf="handleShelfAdd"
        @exclude-tile="handleShelfExclude"
      />

      <div v-if="itemsStore.loading && !hasItems" class="px-5 py-4 space-y-2">
        <SkeletonCard height-class="h-10" />
        <SkeletonCard height-class="h-10" />
        <SkeletonCard height-class="h-10" />
      </div>

      <div v-else-if="!hasItems" class="px-5 py-12 text-center space-y-3">
        <DotLottieVue
          data-testid="list-empty-lottie"
          aria-hidden="true"
          class="mx-auto h-40 w-40"
          src="/animations/cart_empty.lottie"
          :autoplay="true"
          :loop="true"
        />
        <p class="text-sm text-muted-gray">{{ t('list.empty') }}</p>
        <p class="text-xs text-muted-gray mt-1">{{ t('list.emptyHint') }}</p>
      </div>

      <!-- Drag-and-drop reorder of category groups. Touch-only long-press
           (300ms) matches the lists-overview reorder gesture. Open to every
           collaborator - shared per-list ordering, no admin gate. -->
      <VueDraggable
        v-else
        v-model="draggableCategoryPairs"
        tag="div"
        item-key="0"
        :animation="200"
        :delay="300"
        :delay-on-touch-only="true"
        :touch-start-threshold="5"
        :disabled="!canReorderCategories || itemsByCategory.length <= 1"
        ghost-class="cat-section-ghost"
        handle=".cat-drag-handle"
        @end="onCategoryReorder"
      >
        <CategorySection
          v-for="[category, items] in draggableCategoryPairs"
          :key="category"
          :category="category"
          :items="items"
          :collapsed="isCollapsed(category)"
          :can-move-copy="canMoveCopy"
          :pinned-names="pinnedNames"
          :selection-mode="bulkSel.active.value"
          :selected-ids="bulkSel.selected.value"
          @toggle-checked="(id, val) => handleToggleChecked(id, val)"
          @remove-item="(id) => handleRemoveItem(id)"
          @toggle-collapse="(c) => toggleCollapsed(c)"
          @open-edit="handleOpenItemEdit"
          @request-priority="handleRequestPriority"
          @move-copy="handleOpenMoveCopy"
          @toggle-pinned="handleTogglePinned"
          @select-enter="handleSelectEnter"
          @select-toggle="handleSelectToggle"
        />
      </VueDraggable>
    </div>

    <!-- Sticky footer: "Svuota lista" stays visible regardless of list
         length. Hidden only while the autocomplete is active to avoid
         covering the keyboard-driven flow, AND while bulk-selection is on
         (the bulk toolbar replaces it). -->
    <footer
      v-if="hasItems && !autocompleteActive && !bulkSel.active.value"
      data-testid="list-detail-footer"
      class="shrink-0 border-t border-cream-soft bg-cream"
      style="padding-bottom: max(0px, env(safe-area-inset-bottom));"
    >
      <EmptyListButton :count="itemCount" @empty="handleEmptyList" />
    </footer>

    <!-- S3.2: bulk-selection toolbar. Replaces the regular footer while
         selection mode is active. Lives outside the scroll area so it
         stays pinned regardless of list length. -->
    <footer
      v-if="bulkSel.active.value"
      data-testid="bulk-action-toolbar"
      class="shrink-0 border-t border-cream-soft bg-cream"
      style="padding-bottom: max(0px, env(safe-area-inset-bottom));"
    >
      <div class="px-4 py-3 flex items-center gap-2">
        <button
          type="button"
          data-testid="bulk-cancel"
          :aria-label="t('list.cancel')"
          class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="cancelBulkSelection"
        >
          <XIcon :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
        <span
          data-testid="bulk-selected-count"
          class="flex-1 text-sm font-medium text-charcoal"
        >
          {{ t('item.bulkSelectedCount', { n: bulkSel.count.value }, bulkSel.count.value) }}
        </span>
        <button
          type="button"
          data-testid="bulk-priority"
          :aria-label="t('item.bulkPriority')"
          class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
          :disabled="bulkSel.isEmpty.value"
          @click="handleBulkPriority"
        >
          <FlagIcon :size="18" :stroke-width="2" aria-hidden="true" />
        </button>

        <button
          v-if="canMoveCopy"
          type="button"
          data-testid="bulk-move"
          :aria-label="t('item.move')"
          class="inline-flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
          :disabled="bulkSel.isEmpty.value"
          @click="openBulkPicker('move')"
        >
          <MoveIcon :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="bulk-delete"
          :aria-label="t('item.delete')"
          class="inline-flex items-center justify-center w-10 h-10 rounded-full text-red-700 hover:bg-red-50 active:bg-red-100"
          :disabled="bulkSel.isEmpty.value"
          @click="handleBulkDelete"
        >
          <Trash2Icon :size="18" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </footer>

    <ItemEditSheet
      :open="editSheetOpen"
      :item="editingItem"
      :pinned="editingPinned"
      :photo-busy="photoBusy"
      @save="handleEditSave"
      @cancel="handleEditCancel"
      @upload-photo="handleEditUploadPhoto"
      @remove-photo="handleEditRemovePhoto"
    />

    <ConfirmModal
      v-if="excludeCandidate"
      :open="excludeModalOpen"
      :title="t('shelf.excludeTitle')"
      :message="t('shelf.excludeMessage', { name: excludeCandidate.name })"
      :confirm-label="t('shelf.excludeConfirm')"
      :cancel-label="t('shelf.excludeCancel')"
      destructive
      @confirm="confirmExclude"
      @cancel="cancelExclude"
    />

    <ConfirmModal
      v-if="removeCandidate"
      :open="removeModalOpen"
      :title="t('item.removeConfirmTitle')"
      :message="t('item.removeConfirmMessage', { name: removeCandidate.name })"
      :confirm-label="t('item.removeConfirm')"
      :cancel-label="t('item.removeCancel')"
      destructive
      @confirm="confirmRemove"
      @cancel="cancelRemove"
    />

    <ListPickerSheet
      :open="pickerOpen"
      :item="pickerItem"
      :lists="otherLists"
      :busy="pickerBusy"
      :error-message="pickerError"
      @copy="handlePickerCopy"
      @move="handlePickerMove"
      @cancel="handlePickerCancel"
    />

    <!-- S3.2: bulk picker. Reuses the single-item ListPickerSheet UI by
         passing a synthetic "item" whose name is the selection count. -->
    <ListPickerSheet
      :open="bulkPickerOpen"
      :item="bulkPickerOpen ? { name: bulkPickerLabel } : null"
      :lists="otherLists"
      :busy="false"
      :error-message="null"
      @copy="handleBulkPickerCopy"
      @move="handleBulkPickerMove"
      @cancel="closeBulkPicker"
    />

    <PriorityPickerSheet
      :open="priorityOpen"
      :item="priorityItem"
      @select="handlePrioritySelect"
      @cancel="handlePriorityCancel"
    />

    <CompletionCelebration :trigger-key="celebrationKey" />

    <Toast
      :open="toggleToastOpen"
      :message="toggleToastMessage"
      :duration-ms="4500"
      @close="toggleToastOpen = false"
    />

    <Toast
      :open="shareToastOpen"
      :message="shareToastMessage"
      :duration-ms="4500"
      @close="shareToastOpen = false"
    />

    <!-- S3.1: undo toast. Auto-dismisses after the same window the composable
         uses (5s) - when it closes, the composable's timer also fires and
         the firestore commit runs. Action button hands control back to the
         composable's undo path. -->
    <Toast
      :open="undoItemDelete.pending.value !== null"
      :message="undoItemDelete.pending.value?.message ?? ''"
      :action-label="t('common.undo')"
      :action-icon="Undo2"
      :duration-ms="undoItemDelete.pending.value?.durationMs ?? 5000"
      auto-dismiss-with-action
      @close="undoItemDelete.commitCurrent"
      @action="undoItemDelete.undoCurrent"
    />

    <ConfirmModal
      v-if="dontSuggestCandidate"
      :open="dontSuggestCandidate !== null"
      :title="t('item.dontSuggestAgainTitle')"
      :message="t('item.dontSuggestAgainMessage', { name: dontSuggestCandidate.name })"
      :confirm-label="t('item.dontSuggestAgainAction')"
      :cancel-label="t('item.keepSuggesting')"
      destructive
      @confirm="handleDontSuggestConfirm"
      @cancel="closeDontSuggest"
    />

    <BulkPasteSheet
      v-if="bulkPasteOpen"
      :open="bulkPasteOpen"
      :infer-category="inferCategoryForBulk"
      @cancel="closeBulkPaste"
      @submit="handleBulkPasteSubmit"
    />

    <VoiceAddSheet
      v-if="voiceAddOpen"
      :open="voiceAddOpen"
      :infer-category="inferCategoryForBulk"
      @cancel="closeVoiceAdd"
      @submit="handleVoiceAddSubmit"
    />
  </main>
</template>

<style scoped>
.cat-section-ghost {
  opacity: 0.4;
  transform: scale(0.99);
}
</style>
