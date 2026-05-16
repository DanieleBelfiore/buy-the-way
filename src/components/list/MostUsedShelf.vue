<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ShelfTile from '@/components/list/ShelfTile.vue';
import type { CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const STORAGE_KEY = 'btw.shelf.collapsed';

defineProps<{
  entries: CatalogEntry[];
  topIds: Set<ULID>;
  itemNamesInList: Set<string>;
}>();

const emit = defineEmits<{ 'add-from-shelf': [CatalogEntry] }>();

const { t } = useI18n();

const readInitial = (): boolean => {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === 'true';
};

const collapsed = ref(readInitial());

const toggle = () => {
  collapsed.value = !collapsed.value;
  sessionStorage.setItem(STORAGE_KEY, String(collapsed.value));
};

const onAdd = (entry: CatalogEntry) => emit('add-from-shelf', entry);
</script>

<template>
  <section class="px-5 pt-4 pb-2">
    <header class="flex items-center justify-between mb-2">
      <h2 class="text-sm font-semibold text-charcoal tracking-tight">
        {{ t('shelf.title') }}
        <span v-if="entries.length > 0" class="ml-1 text-xs text-muted-gray font-normal">
          {{ entries.length }}
        </span>
      </h2>
      <button
        type="button"
        data-testid="shelf-toggle"
        :aria-label="collapsed ? t('shelf.expand') : t('shelf.collapse')"
        :aria-expanded="!collapsed"
        class="flex items-center justify-center w-8 h-8 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
        @click="toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="['transition-transform', collapsed ? '-rotate-90' : 'rotate-0']"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </header>

    <div v-if="!collapsed">
      <p v-if="entries.length === 0" class="text-sm text-muted-gray italic py-3">
        {{ t('shelf.empty') }}
      </p>
      <div v-else class="grid grid-cols-2 gap-2">
        <ShelfTile
          v-for="entry in entries"
          :key="entry.id"
          :entry="entry"
          :is-top="topIds.has(entry.id)"
          :is-in-list="itemNamesInList.has(entry.name)"
          @add="onAdd"
        />
      </div>
    </div>
  </section>
</template>
