<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { addItem, toggleChecked, removeItem, emptyList } from '@/services/items.service';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import EmptyListButton from '@/components/list/EmptyListButton.vue';
import type { Category, CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const listsStore = useListsStore();
const itemsStore = useItemsStore();
const authStore = useAuthStore();
const catalogStore = useCatalogStore();

const listId = computed(() => route.params.id as ULID);
const list = computed(() => listsStore.lists.find((l) => l.id === listId.value));
const itemsByCategory = computed(() => itemsStore.itemsByCategory);
const hasItems = computed(() => itemsStore.items.length > 0);
const shelfEntries = computed(() => catalogStore.rankedEntries);
const shelfTopIds = computed(() => catalogStore.topIds);
const itemNamesInList = computed(() => new Set(itemsStore.items.map((i) => i.name)));
const itemNamesLowerInList = computed(
  () => new Set(itemsStore.items.map((i) => i.name.toLowerCase())),
);
const itemCount = computed(() => itemsStore.items.length);
const autocompleteActive = ref(false);

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
  } catch (err) {
    console.error('[ListDetailView] addItem failed:', err);
  }
};

const handleToggleChecked = async (itemId: ULID, checked: boolean) => {
  try {
    await toggleChecked(listId.value, itemId, checked);
  } catch (err) {
    console.error('[ListDetailView] toggleChecked failed:', err);
  }
};

const handleRemoveItem = async (itemId: ULID) => {
  try {
    await removeItem(listId.value, itemId);
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
  <main class="min-h-screen bg-cream">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        aria-label="Back"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.back()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight truncate flex-1">
        {{ list?.name ?? '…' }}
      </h1>
      <button
        aria-label="List settings"
        data-testid="open-list-settings"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal hover:bg-black/5 active:bg-black/10"
        @click="router.push({ name: 'list-settings', params: { id: listId } })"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </header>

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
    />

    <div v-if="!hasItems" class="px-5 py-12 text-center">
      <p class="text-sm text-muted-gray">{{ t('list.empty') }}</p>
      <p class="text-xs text-muted-gray mt-1">{{ t('list.emptyHint') }}</p>
    </div>

    <div v-else>
      <CategorySection
        v-for="[category, items] in itemsByCategory"
        :key="category"
        :category="category"
        :items="items"
        @toggle-checked="(id, val) => handleToggleChecked(id, val)"
        @remove-item="(id) => handleRemoveItem(id)"
      />
      <div class="mx-5 my-4 border-t border-dashed border-cream-soft" />
      <EmptyListButton
        v-if="!autocompleteActive"
        :count="itemCount"
        @empty="handleEmptyList"
      />
    </div>
  </main>
</template>
