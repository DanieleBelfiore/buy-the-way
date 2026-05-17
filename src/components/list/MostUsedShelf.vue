<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Star } from '@lucide/vue';
import ShelfTile from '@/components/list/ShelfTile.vue';
import type { CatalogEntry } from '@/domain/types';
import type { ULID } from '@/domain/id';

const STORAGE_KEY = 'btw.shelf.collapsed';

defineProps<{
  entries: CatalogEntry[];
  topIds: Set<ULID>;
  itemNamesInList: Set<string>;
}>();

const emit = defineEmits<{
  'add-from-shelf': [CatalogEntry];
  'long-press-tile': [CatalogEntry];
}>();

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
const onLongPress = (entry: CatalogEntry) => emit('long-press-tile', entry);
</script>

<template>
  <section v-if="entries.length > 0" class="px-5 pt-4 pb-2">
    <header class="flex items-center justify-between mb-2">
      <h2
        data-testid="shelf-title"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal tracking-tight cursor-pointer select-none"
        @click="toggle"
      >
        <Star :size="14" :stroke-width="2" fill="currentColor" aria-hidden="true" />
        <span>{{ t('shelf.title') }}</span>
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

    <TransitionGroup v-if="!collapsed" name="shelf-tile" tag="div" class="grid grid-cols-2 gap-2">
      <ShelfTile
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        :is-top="topIds.has(entry.id)"
        :is-in-list="itemNamesInList.has(entry.name)"
        @add="onAdd"
        @long-press="onLongPress"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.shelf-tile-enter-active,
.shelf-tile-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.shelf-tile-enter-from {
  opacity: 0;
  transform: scale(0.92);
}
.shelf-tile-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
.shelf-tile-leave-active {
  position: absolute;
}
.shelf-tile-move {
  transition: transform 260ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .shelf-tile-enter-active,
  .shelf-tile-leave-active,
  .shelf-tile-move {
    transition: none;
  }
  .shelf-tile-enter-from,
  .shelf-tile-leave-to {
    transform: none;
  }
}
</style>
