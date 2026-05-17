<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useHaptic } from '@/composables/useHaptic';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { addItem, toggleChecked, removeItem, emptyList, updateItem } from '@/services/items.service';
import {
  setCatalogExcluded,
  setCatalogPinned,
  findCatalogEntryByName,
} from '@/services/catalog.service';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';
import { CATEGORIES } from '@/domain/categories';
import { FAVORITES_MIN_USES } from '@/domain/ranking';
import { sortCategoriesByLabel } from '@/domain/sort';
import { useCollapsedCategories } from '@/composables/useCollapsedCategories';
import { ArrowLeft, Settings as SettingsIcon } from '@lucide/vue';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import EmptyListButton from '@/components/list/EmptyListButton.vue';
import ItemEditSheet from '@/components/list/ItemEditSheet.vue';
import SkeletonCard from '@/components/ui/SkeletonCard.vue';
import type { Category, CatalogEntry, Item } from '@/domain/types';
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
const itemNamesInList = computed(() => new Set(itemsStore.items.map((i) => i.name)));
const itemNamesLowerInList = computed(
  () => new Set(itemsStore.items.map((i) => i.name.toLowerCase())),
);
const itemCount = computed(() => itemsStore.items.length);
const boughtCount = computed(() => itemsStore.items.filter((i) => i.checked).length);
const usersCount = computed(() => list.value?.collaboratorUids.length ?? 0);
const autocompleteActive = ref(false);

const { isCollapsed, toggle: toggleCollapsed } = useCollapsedCategories(
  computed(() => String(listId.value)),
);

const editingItem = ref<Item | null>(null);
const editSheetOpen = computed(() => editingItem.value !== null);
const editingPinned = ref(false);

const excludeCandidate = ref<CatalogEntry | null>(null);
const excludeModalOpen = computed(() => excludeCandidate.value !== null);

const removeCandidate = ref<Item | null>(null);
const removeModalOpen = computed(() => removeCandidate.value !== null);

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

const handleLongPress = async (item: Item): Promise<void> => {
  editingItem.value = item;
  editingPinned.value = false;
  if (!authStore.user) return;
  try {
    const entry = await findCatalogEntryByName(authStore.user.uid, item.name);
    if (!entry) {
      editingPinned.value = false;
      return;
    }
    if (entry.excluded) {
      editingPinned.value = false;
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
        if (patch.pinned) {
          await setCatalogPinned(authStore.user.uid, entry.id, true);
        } else {
          await setCatalogExcluded(authStore.user.uid, entry.id, true);
        }
      }
    }
  } catch (err) {
    console.error('[ListDetailView] updateItem failed:', err);
  }
};

const handleShelfLongPress = (entry: CatalogEntry): void => {
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
    pulse();
  } catch (err) {
    console.error('[ListDetailView] addItem failed:', err);
  }
};

const handleToggleChecked = async (itemId: ULID, checked: boolean) => {
  try {
    await toggleChecked(listId.value, itemId, checked);
    pulse();
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

const confirmRemove = async (): Promise<void> => {
  const target = removeCandidate.value;
  removeCandidate.value = null;
  if (!target) return;
  try {
    await removeItem(listId.value, target.id);
    pulse();
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
});

onUnmounted(() => {
  _listsUnsub?.();
  itemsStore.setCurrentList(null);
});
</script>

<template>
  <main class="min-h-screen bg-cream flex flex-col pb-4">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.back()"
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

    <!-- Stats strip -->
    <div
      v-if="list"
      data-testid="list-stats"
      class="px-5 pb-3 flex items-center gap-3 text-xs text-muted-gray"
    >
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
      <span data-testid="stat-users" class="inline-flex items-center gap-1">
        <span>{{ t('listSettings.stats.users') }}:</span>
        <span class="font-semibold text-charcoal">{{ usersCount }}</span>
      </span>
    </div>

    <div class="px-0">
      <ItemAutocomplete
        :exclude-names="itemNamesLowerInList"
        @add-item="handleAddItem"
        @active-change="(v) => (autocompleteActive = v)"
      />
    </div>

    <MostUsedShelf
      :entries="shelfEntries"
      :top-ids="shelfTopIds"
      :item-names-in-list="itemNamesInList"
      @add-from-shelf="handleShelfAdd"
      @long-press-tile="handleShelfLongPress"
    />

    <div v-if="itemsStore.loading && !hasItems" class="px-5 py-4 space-y-2">
      <SkeletonCard height-class="h-10" />
      <SkeletonCard height-class="h-10" />
      <SkeletonCard height-class="h-10" />
    </div>

    <div v-else-if="!hasItems" class="px-5 py-12 text-center space-y-3">
      <img
        src="@/assets/illustrations/empty-items.svg"
        alt=""
        aria-hidden="true"
        loading="lazy"
        class="mx-auto h-28 w-28 opacity-90"
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
        @toggle-checked="(id, val) => handleToggleChecked(id, val)"
        @remove-item="(id) => handleRemoveItem(id)"
        @toggle-collapse="(c) => toggleCollapsed(c)"
        @long-press="handleLongPress"
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
  </main>
</template>
