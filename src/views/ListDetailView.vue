<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useHaptic } from '@/composables/useHaptic';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import {
  addItem,
  toggleChecked,
  removeItem,
  emptyList,
  updateItem,
  setItemPriority,
  copyItem,
  moveItem,
} from '@/services/items.service';
import {
  setCatalogExcluded,
  setCatalogFavoriteState,
  findCatalogEntryByName,
} from '@/services/catalog.service';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { CATEGORIES } from '@/domain/categories';
import { isCustomItemName } from '@/domain/public-catalog';
import { FAVORITES_MIN_USES } from '@/domain/ranking';
import { sortCategoriesByLabel } from '@/domain/sort';
import { useCollapsedCategories } from '@/composables/useCollapsedCategories';
import { ArrowLeft, Settings as SettingsIcon } from '@lucide/vue';
import { getUsersByUids } from '@/services/users.service';
import { useSafeBack } from '@/composables/useSafeBack';
import type { UserProfile } from '@/domain/types';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import EmptyListButton from '@/components/list/EmptyListButton.vue';
import ItemEditSheet from '@/components/list/ItemEditSheet.vue';
import ListPickerSheet from '@/components/list/ListPickerSheet.vue';
import PriorityPickerSheet from '@/components/list/PriorityPickerSheet.vue';
import CompletionCelebration from '@/components/ui/CompletionCelebration.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import Toast from '@/components/ui/Toast.vue';
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import type { Category, CatalogEntry, Item, ItemPriority } from '@/domain/types';
import type { ULID } from '@/domain/id';

const { t, locale } = useI18n();
const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();
const itemsStore = useItemsStore();
const authStore = useAuthStore();
const catalogStore = useCatalogStore();

const listId = computed(() => route.params.id as ULID);
const list = computed(() => listsStore.lists.find((l) => l.id === listId.value));
const itemsByCategory = computed<[Category, Item[]][]>(() => {
  const map = itemsStore.itemsByCategory;
  const present = [...map.keys()];
  const sorted = sortCategoriesByLabel(present, (c) => t(CATEGORIES[c].labelKey), locale.value);
  return sorted.map((c) => [c, map.get(c)!] as [Category, Item[]]);
});
const hasItems = computed(() => itemsStore.items.length > 0);
const shelfEntries = computed(() => catalogStore.rankedEntries);
const shelfTopIds = computed(() => catalogStore.topIds);
const itemCount = computed(() => itemsStore.items.length);
const boughtCount = computed(() => itemsStore.items.filter((i) => i.checked).length);
const usersCount = computed(() => list.value?.collaboratorUids.length ?? 0);

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

const celebrationKey = ref(0);
const wasComplete = ref(false);
// Armed once we observe a non-complete state with items present — prevents
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

const editingItem = ref<Item | null>(null);
const editSheetOpen = computed(() => editingItem.value !== null);
const editingPinned = ref(false);

const excludeCandidate = ref<CatalogEntry | null>(null);
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

const pinnedNames = computed<Set<string>>(() => {
  const min = FAVORITES_MIN_USES;
  const names = new Set<string>();
  for (const entry of catalogStore.entries) {
    if (entry.excluded) continue;
    if (entry.dismissedFavorite) continue;
    if (entry.pinned || entry.usageCount >= min) {
      names.add(entry.name);
    }
  }
  return names;
});

const handleRequestPriority = (item: Item): void => {
  priorityItem.value = item;
};

const handlePrioritySelect = async (priority: ItemPriority | null): Promise<void> => {
  const target = priorityItem.value;
  priorityItem.value = null;
  if (!target) return;
  try {
    await setItemPriority(listId.value, target.id, priority);
    pulse();
  } catch (err) {
    console.error('[ListDetailView] setItemPriority failed:', err);
  }
};

const handlePriorityCancel = (): void => {
  priorityItem.value = null;
};

const handleTogglePinned = async (item: Item): Promise<void> => {
  if (!authStore.user) return;
  try {
    const entry = await findCatalogEntryByName(authStore.user.uid, item.name);
    if (!entry) return;
    const currentlyFavorite = pinnedNames.value.has(item.name);
    await setCatalogFavoriteState(authStore.user.uid, entry.id, !currentlyFavorite);
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
  editingItem.value = item;
  editingPinned.value = false;
  if (!authStore.user) return;
  try {
    const entry = await findCatalogEntryByName(authStore.user.uid, item.name);
    if (!entry) {
      editingPinned.value = false;
      return;
    }
    if (entry.excluded || entry.dismissedFavorite) {
      editingPinned.value = Boolean(entry.pinned);
    } else {
      editingPinned.value = Boolean(entry.pinned) || entry.usageCount >= FAVORITES_MIN_USES;
    }
  } catch (err) {
    console.warn('[ListDetailView] lookup catalog entry failed:', err);
  }
};

const handleEditCancel = (): void => {
  editingItem.value = null;
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
  editingItem.value = null;
  try {
    await updateItem(listId.value, id, {
      name: patch.name,
      quantity: patch.quantity,
      note: patch.note,
      category: patch.category,
    });
    if (patch.pinned !== previousPinned) {
      const entry = await findCatalogEntryByName(authStore.user.uid, itemName);
      if (entry) {
        await setCatalogFavoriteState(authStore.user.uid, entry.id, patch.pinned);
      }
    }
  } catch (err) {
    console.error('[ListDetailView] updateItem failed:', err);
  }
};

const handleShelfExclude = (entry: CatalogEntry): void => {
  excludeCandidate.value = entry;
};

const cancelExclude = (): void => {
  excludeCandidate.value = null;
};

const confirmExclude = async (): Promise<void> => {
  const target = excludeCandidate.value;
  excludeCandidate.value = null;
  if (!target || !authStore.user) return;
  try {
    await setCatalogExcluded(authStore.user.uid, target.id, true);
  } catch (err) {
    console.error('[ListDetailView] exclude favorite failed:', err);
  }
};

const handleShelfAdd = async (entry: CatalogEntry) => {
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
    // Storage unavailable — skip the toast rather than fire it every time.
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

const dontSuggestToast = ref<{ name: string; entryId: ULID } | null>(null);
let _dontSuggestTimer: ReturnType<typeof setTimeout> | null = null;

const closeDontSuggestToast = (): void => {
  dontSuggestToast.value = null;
  if (_dontSuggestTimer) {
    clearTimeout(_dontSuggestTimer);
    _dontSuggestTimer = null;
  }
};

const maybeOfferDontSuggest = async (removedName: string): Promise<void> => {
  if (!authStore.user) return;
  if (!isCustomItemName(removedName, locale.value)) return;
  try {
    const entry = await findCatalogEntryByName(authStore.user.uid, removedName);
    if (!entry || entry.excluded) return;
    closeDontSuggestToast();
    dontSuggestToast.value = { name: removedName, entryId: entry.id };
    _dontSuggestTimer = setTimeout(() => {
      closeDontSuggestToast();
    }, 6000);
  } catch (err) {
    console.warn('[ListDetailView] dont-suggest lookup failed:', err);
  }
};

const handleDontSuggestAction = async (): Promise<void> => {
  const target = dontSuggestToast.value;
  closeDontSuggestToast();
  if (!target || !authStore.user) return;
  try {
    await setCatalogExcluded(authStore.user.uid, target.entryId, true);
  } catch (err) {
    console.error('[ListDetailView] dont-suggest exclude failed:', err);
  }
};

const confirmRemove = async (): Promise<void> => {
  const target = removeCandidate.value;
  removeCandidate.value = null;
  if (!target) return;
  try {
    await removeItem(listId.value, target.id);
    pulse();
    void maybeOfferDontSuggest(target.name);
  } catch (err) {
    console.error('[ListDetailView] removeItem failed:', err);
  }
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

onMounted(() => {
  _listsUnsub = listsStore.subscribe();
  itemsStore.setCurrentList(listId.value);
  if (authStore.user) {
    catalogStore.subscribe(authStore.user.uid);
  }
  // Ensure profile is loaded so the stale-default cleanup below can compare
  // listId.value to authStore.profile.defaultListId.
  void authStore.ensureProfile();
  // Per-list NEW badge: load the user's per-list seen map, then mark THIS
  // list as seen. Runs in the background — the badge clears as soon as the
  // optimistic local update propagates to ListsView.
  void (async () => {
    await listsStore.loadLastSeen();
    await listsStore.markSeen(listId.value);
  })();
});

onUnmounted(() => {
  _listsUnsub?.();
  itemsStore.setCurrentList(null);
  closeDontSuggestToast();
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
    // Wait until the Firestore subscription has delivered at least once —
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
  <main class="min-h-screen min-h-dvh bg-cream flex flex-col pb-4">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
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

    <!-- Stats strip — two rows on every viewport: row 1 covers the at-a-glance
         counts (items / bought / users), row 2 reserves a dedicated line for
         the "updated" timestamp which would otherwise wrap awkwardly on
         narrow phones. -->
    <div
      v-if="list"
      data-testid="list-stats"
      class="px-5 pb-3 flex flex-col gap-y-1 text-xs text-muted-gray"
    >
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
      <span
        data-testid="stat-updated"
        class="inline-flex items-center gap-1"
      >
        <span>{{ t('listSettings.stats.updated') }}:</span>
        <span class="font-semibold text-charcoal">{{ updatedLabel }}</span>
      </span>
    </div>

    <div class="px-0">
      <ItemAutocomplete
        @add-item="handleAddItem"
        @active-change="(v) => (autocompleteActive = v)"
      />
    </div>

    <MostUsedShelf
      v-if="list?.showFavorites !== false"
      :entries="shelfEntries"
      :top-ids="shelfTopIds"
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

    <div v-else>
      <CategorySection
        v-for="[category, items] in itemsByCategory"
        :key="category"
        :category="category"
        :items="items"
        :collapsed="isCollapsed(category)"
        :can-move-copy="canMoveCopy"
        :pinned-names="pinnedNames"
        @toggle-checked="(id, val) => handleToggleChecked(id, val)"
        @remove-item="(id) => handleRemoveItem(id)"
        @toggle-collapse="(c) => toggleCollapsed(c)"
        @open-edit="handleOpenItemEdit"
        @request-priority="handleRequestPriority"
        @move-copy="handleOpenMoveCopy"
        @toggle-pinned="handleTogglePinned"
      />
    </div>

    <div class="mt-auto">
      <div
        v-if="hasItems && !autocompleteActive"
        class="mx-5 my-4 border-t border-dashed border-cream-soft"
      />
      <EmptyListButton
        v-if="hasItems && !autocompleteActive"
        :count="itemCount"
        @empty="handleEmptyList"
      />
    </div>

    <ItemEditSheet
      :open="editSheetOpen"
      :item="editingItem"
      :pinned="editingPinned"
      @save="handleEditSave"
      @cancel="handleEditCancel"
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
      :open="dontSuggestToast !== null"
      :message="dontSuggestToast ? t('item.dontSuggestAgainMessage', { name: dontSuggestToast.name }) : ''"
      :action-label="t('item.dontSuggestAgainAction')"
      @action="handleDontSuggestAction"
      @close="closeDontSuggestToast"
    />
  </main>
</template>
