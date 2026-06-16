<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCollapsedCategories } from '@/composables/useCollapsedCategories';
import { useCollaboratorProfiles } from '@/composables/useCollaboratorProfiles';
import { useListDetailActions } from '@/composables/useListDetailActions';
import { ArrowLeft, Settings as SettingsIcon, Share2 } from '@lucide/vue';
import { notifyListEvent } from '@/services/notify.service';
import { useSafeBack } from '@/composables/useSafeBack';
import { VueDraggable } from 'vue-draggable-plus';
import { reconcileListUrgentCount, setListCategoryOrder } from '@/services/lists.service';
import { recordListHistory } from '@/services/history.service';
import {
  clearListHistoryRecorded,
  markListHistoryRecorded,
  wasListHistoryRecorded,
} from '@/domain/listHistoryCycle';
import { Undo2, X as XIcon, Trash2 as Trash2Icon, ArrowRightLeft as MoveIcon, Flag as FlagIcon } from '@lucide/vue';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { CATEGORIES } from '@/domain/categories';
import { sortCategoriesWithPreference } from '@/domain/sort';
import { duplicateItemIds, favoritePresenceKeys } from '@/domain/item-identity';
import { countUrgentItems } from '@/domain/priority';
import ItemCountWithUrgent from '@/components/list/ItemCountWithUrgent.vue';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { useListFavoritesStore } from '@/stores/listFavorites';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import FavoritesSheet from '@/components/list/FavoritesSheet.vue';
import ListFooterActionsMenu from '@/components/list/ListFooterActionsMenu.vue';
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
import type { Category, Item } from '@/domain/types';
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
const favoritePresence = computed(() => favoritePresenceKeys(itemsStore.visibleItems));
const possibleDuplicateIds = computed(() => duplicateItemIds(itemsStore.visibleItems));
const itemCount = computed(() => itemsStore.visibleItems.length);
const urgentItemCount = computed(() => countUrgentItems(itemsStore.visibleItems));

watch(
  [urgentItemCount, () => list.value?.urgentCount, () => list.value?.id, () => itemsStore.loading],
  ([computedUrgent, storedUrgent, id, loading]) => {
    if (!id || loading) return;
    const stored = storedUrgent ?? 0;
    if (stored === computedUrgent) return;
    void reconcileListUrgentCount(id, computedUrgent, stored).catch((err) => {
      console.warn('[ListDetailView] reconcileListUrgentCount failed:', err);
    });
  },
);

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

// Collaborator avatars (lazy-loaded via composable).
const collaboratorUids = computed<readonly string[]>(
  () => list.value?.collaboratorUids ?? [],
);
const {
  visibleMembers,
  overflowMembersCount,
  initialFor,
  avatarColorFor,
} = useCollaboratorProfiles(collaboratorUids);

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
    if (!complete && items > 0) {
      everHadIncompleteItems.value = true;
      clearListHistoryRecorded(listId.value);
    }
    if (complete && !wasComplete.value && everHadIncompleteItems.value) {
      celebrationKey.value += 1;
      const uid = authStore.user?.uid;
      if (uid && !wasListHistoryRecorded(listId.value)) {
        void recordListHistory(
          listId.value,
          itemsStore.visibleItems,
          uid,
          'completion',
        )
          .then(() => markListHistoryRecorded(listId.value))
          .catch((err) => {
            console.warn('[ListDetailView] recordListHistory failed:', err);
          });
      }
    }
    wasComplete.value = complete;
  },
  { immediate: false },
);

const { isCollapsed, toggle: toggleCollapsed, expandIfCollapsed } = useCollapsedCategories(
  computed(() => String(listId.value)),
);

const previouslyAllChecked = new Set<Category>();

const {
  bulkSel,
  undoItemDelete,
  inferCategoryForBulk,
  closeDontSuggest,
  pinnedNames,
  editingItem,
  editSheetOpen,
  editingPinned,
  photoBusy,
  handleOpenItemEdit,
  handleEditCancel,
  handleEditUploadPhoto,
  handleEditRemovePhoto,
  handleEditSave,
  handleShelfExclude,
  excludeCandidate,
  excludeModalOpen,
  cancelExclude,
  confirmExclude,
  handleShelfAdd,
  removeCandidate,
  removeModalOpen,
  cancelRemove,
  confirmRemove,
  handleRemoveItem,
  pickerItem,
  pickerOpen,
  pickerBusy,
  pickerError,
  handleOpenMoveCopy,
  handlePickerCancel,
  handlePickerCopy,
  handlePickerMove,
  priorityItem,
  priorityOpen,
  handleRequestPriority,
  handlePrioritySelect,
  handlePriorityCancel,
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
  handleAddItem,
  handleToggleChecked,
  handleEmptyList,
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
  toggleToastOpen,
  toggleToastMessage,
  dontSuggestCandidate,
  handleDontSuggestConfirm,
} = useListDetailActions({ listId, expandIfCollapsed, previouslyAllChecked });

// Post-completion prompt: once the "all bought" celebration ends, offer to
// empty the list as if the user had tapped the empty-list button.
const emptyPromptOpen = ref(false);

const onCelebrationFinished = (): void => {
  // Re-check state: the user may have added or unchecked an item during the
  // animation, in which case emptying would be surprising.
  if (itemCount.value > 0 && boughtCount.value === itemCount.value) {
    emptyPromptOpen.value = true;
  }
};

const onCompletionEmptyConfirm = (): void => {
  emptyPromptOpen.value = false;
  void handleEmptyList();
};

const otherLists = computed(() =>
  listsStore.lists.filter((l) => l.id !== listId.value),
);
const canMoveCopy = computed(() => otherLists.value.length > 0);

watch(
  () => shelfEntries.value.length,
  (count) => {
    if (count === 0 && favoritesOpen.value) closeFavorites();
  },
);

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
  <!-- `fixed inset-0` fills the iOS standalone display edge-to-edge
       (viewport-fit=cover). `h-dvh` alone can stop above the home-indicator
       strip and expose the system black bar underneath. -->
  <main class="fixed inset-0 bg-cream flex flex-col overflow-hidden">
    <header class="px-5 pt-6 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
        @click="handleBack"
      >
        <ArrowLeft :size="24" :stroke-width="2.5" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate flex-1 min-w-0">
        {{ list?.name ?? '…' }}
      </h1>
      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="itemCount > 0"
          :aria-label="t('list.share')"
          data-testid="share-list"
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal transition-colors"
          @click="handleShareList"
        >
          <Share2 :size="20" :stroke-width="2.25" aria-hidden="true" />
        </button>
        <button
          :aria-label="t('listSettings.title')"
          data-testid="open-list-settings"
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
          @click="router.push({ name: 'list-settings', params: { id: listId } })"
        >
          <SettingsIcon :size="20" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>
    </header>

    <!-- Stats strip - two rows on every viewport: row 1 covers the at-a-glance
         counts (items / bought / users), row 2 reserves a dedicated line for
         the "updated" timestamp which would otherwise wrap awkwardly on
         narrow phones. -->
    <div
      v-if="list"
      data-testid="list-stats"
      class="px-5 pb-3 flex flex-col gap-y-1 text-sm text-muted-gray"
    >
      <div class="flex items-center gap-3">
        <ItemCountWithUrgent
          data-testid="stat-items"
          :count="itemCount"
          :urgent-count="urgentItemCount"
        />
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
      <span
        data-testid="stat-updated"
        class="inline-flex items-center gap-1"
      >
        <span>{{ t('listSettings.stats.updated') }}:</span>
        <span class="font-semibold text-charcoal">{{ updatedLabel }}</span>
      </span>
    </div>

    <!-- Scrollable item list region. `min-h-0` is required for the flex
         child to shrink below its intrinsic content height so the inner
         overflow-y-auto can actually scroll instead of pushing the parent. -->
    <div
      data-testid="list-items-scroll"
      class="flex-1 min-h-0 overflow-y-auto pb-4"
    >
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
          :duplicate-item-ids="possibleDuplicateIds"
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

    <!-- Sticky footer: add-item row stays visible regardless of list length.
         Hidden only while bulk-selection is on (the bulk toolbar replaces it). -->
    <footer
      v-if="!bulkSel.active.value"
      data-testid="list-detail-footer"
      class="shrink-0 border-t border-cream-soft bg-cream pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div class="pl-3 pr-1 flex items-center gap-0 min-w-0">
        <ItemAutocomplete
          class="flex-1 min-w-0 [&_input]:h-11 [&_input]:box-border [&_input]:py-0 [&_input]:px-3 [&_input]:leading-[2.75rem]"
          dropdown-placement="above"
          @add-item="handleAddItem"
        />
        <div class="flex items-center -space-x-1 shrink-0">
          <ListFooterActionsMenu
            :show-favorites="shelfEntries.length > 0"
            @open-favorites="openFavorites"
            @open-voice="openVoiceAdd"
            @open-bulk="openBulkPaste"
          />
          <EmptyListButton
            :count="itemCount"
            :bought-count="boughtCount"
            @empty="(scope) => void handleEmptyList(scope)"
          />
        </div>
      </div>
    </footer>

    <!-- S3.2: bulk-selection toolbar. Replaces the regular footer while
         selection mode is active. Lives outside the scroll area so it
         stays pinned regardless of list length. -->
    <footer
      v-if="bulkSel.active.value"
      data-testid="bulk-action-toolbar"
      class="shrink-0 border-t border-cream-soft bg-cream pb-safe"
    >
      <div class="px-4 py-3 flex items-center gap-2">
        <button
          type="button"
          data-testid="bulk-cancel"
          :aria-label="t('list.cancel')"
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
          @click="cancelBulkSelection"
        >
          <XIcon :size="20" :stroke-width="2" aria-hidden="true" />
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
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
          :disabled="bulkSel.isEmpty.value"
          @click="handleBulkPriority"
        >
          <FlagIcon :size="20" :stroke-width="2" aria-hidden="true" />
        </button>

        <button
          v-if="canMoveCopy"
          type="button"
          data-testid="bulk-move"
          :aria-label="t('item.move')"
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-charcoal"
          :disabled="bulkSel.isEmpty.value"
          @click="openBulkPicker('move')"
        >
          <MoveIcon :size="20" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="bulk-delete"
          :aria-label="t('item.delete')"
          class="inline-flex items-center justify-center w-11 h-11 rounded-full text-red-700"
          :disabled="bulkSel.isEmpty.value"
          @click="handleBulkDelete"
        >
          <Trash2Icon :size="20" :stroke-width="2" aria-hidden="true" />
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

    <CompletionCelebration :trigger-key="celebrationKey" @finished="onCelebrationFinished" />

    <ConfirmModal
      :open="emptyPromptOpen"
      :title="t('list.completionEmptyTitle')"
      :message="t('list.completionEmptyMessage')"
      :confirm-label="t('list.completionEmptyConfirm')"
      :cancel-label="t('list.completionEmptyCancel')"
      destructive
      @confirm="onCompletionEmptyConfirm"
      @cancel="emptyPromptOpen = false"
    />

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
         uses (1s) - when it closes, the composable's timer also fires and
         the firestore commit runs. Action button hands control back to the
         composable's undo path. -->
    <Toast
      :open="undoItemDelete.pending.value !== null"
      :message="undoItemDelete.pending.value?.message ?? ''"
      :action-label="t('common.undo')"
      :action-icon="Undo2"
      :dismiss-label="t('common.dismissToast')"
      :duration-ms="undoItemDelete.pending.value?.durationMs ?? 1000"
      dismissible
      swipeable
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

    <FavoritesSheet
      v-if="favoritesOpen"
      :open="favoritesOpen"
      :entries="shelfEntries"
      :top-slugs="shelfTopSlugs"
      :presence-keys="favoritePresence"
      @cancel="closeFavorites"
      @add-from-shelf="handleShelfAdd"
      @exclude-tile="handleShelfExclude"
    />
  </main>
</template>

<style scoped>
.cat-section-ghost {
  opacity: 0.4;
  transform: scale(0.99);
}
</style>
