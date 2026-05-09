<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useCatalogStore } from '@/stores/catalog';
import { CATEGORIES } from '@/domain/categories';
import type { Category, CatalogEntry, Item } from '@/domain/types';
import type { ULID } from '@/domain/id';
import ListItemRow from '@/components/list/ListItemRow.vue';
import CategoryHeader from '@/components/list/CategoryHeader.vue';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import IconSettings from '@/components/ui/icons/IconSettings.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const lists = useListsStore();
const itemsStore = useItemsStore();
const catalog = useCatalogStore();

const listId = route.params.id as ULID;
const list = computed(() => lists.getById(listId));
const allItems = computed(() => itemsStore.forList(listId));

const addedNames = computed(() => allItems.value.map((i) => i.name));

const categorySections = computed(() => {
  const groups = new Map<Category, Item[]>();
  for (const item of allItems.value) {
    const group = groups.get(item.category) ?? [];
    group.push(item);
    groups.set(item.category, group);
  }

  return CATEGORIES.flatMap((cat) => {
    const group = groups.get(cat);
    if (!group || group.length === 0) return [];
    const sorted = [...group].sort((a, b) => {
      if (a.checked === b.checked) return 0;
      return a.checked ? 1 : -1;
    });
    return [{ cat, items: sorted }];
  });
});

const handleSelectItem = (name: string, category: Category): void => {
  itemsStore.add(listId, { name, category, quantity: '', note: '' });
};

const handleAutocompleteSelect = (payload: { name: string; category: Category }): void => {
  handleSelectItem(payload.name, payload.category);
};

const handleShelfAdd = (entry: CatalogEntry): void => {
  handleSelectItem(entry.name, entry.category);
};

const handleToggle = (item: Item): void => {
  itemsStore.toggleChecked(listId, item.id);
};
</script>

<template>
  <div class="list-detail" data-view="ListDetailView">
    <header class="list-detail__header appbar">
      <button class="iconbtn" @click="router.back()">←</button>
      <h1 class="list-detail__title">{{ list?.name }}</h1>
      <router-link
        :to="`/lists/${listId}/settings`"
        class="iconbtn"
        :aria-label="t('settings.account')"
      >
        <IconSettings :size="20" />
      </router-link>
    </header>

    <div data-testid="autocomplete" class="list-detail__autocomplete">
      <ItemAutocomplete
        :entries="catalog.entries"
        :placeholder="t('home.fab')"
        @select="handleAutocompleteSelect"
      />
    </div>

    <MostUsedShelf
      :entries="catalog.entries"
      :added-names="addedNames"
      @add="handleShelfAdd"
    />

    <div class="list-detail__sections">
      <section
        v-for="{ cat, items } in categorySections"
        :key="cat"
        :data-testid="`category-section-${cat}`"
        class="list-detail__section"
      >
        <CategoryHeader
          :category="cat"
          :checked="items.filter((i) => i.checked).length"
          :total="items.length"
        />
        <ul class="list-detail__items">
          <li v-for="item in items" :key="item.id">
            <ListItemRow
              :name="item.name"
              :quantity="item.quantity"
              :checked="item.checked"
              :category="item.category"
              @toggle="handleToggle(item)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.list-detail {
  min-height: 100dvh;
  background: var(--cream);
  padding-bottom: var(--space-20);
}

.list-detail__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
}

.list-detail__title {
  flex: 1;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-detail__autocomplete {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--cream);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--cream-soft);
}

.list-detail__sections {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.list-detail__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.list-detail__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
