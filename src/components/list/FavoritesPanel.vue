<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ShelfTile from '@/components/list/ShelfTile.vue';
import { CATEGORIES } from '@/domain/categories';
import { groupCatalogByCategory } from '@/domain/sort';
import { favoritePresenceKey } from '@/domain/item-identity';
import type { Category, ListFavoriteState } from '@/domain/types';

const props = defineProps<{
  entries: ListFavoriteState[];
  topSlugs: Set<string>;
  presenceKeys?: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  'add-from-shelf': [ListFavoriteState];
  'exclude-tile': [ListFavoriteState];
}>();

const { t, locale } = useI18n();

const onAdd = (entry: ListFavoriteState) => emit('add-from-shelf', entry);
const onExclude = (entry: ListFavoriteState) => emit('exclude-tile', entry);

const stableEntries = ref<ListFavoriteState[]>([...props.entries]);

const sameSlugs = (
  a: readonly ListFavoriteState[],
  b: readonly ListFavoriteState[],
): boolean => {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map((e) => e.slug));
  for (const e of b) if (!setA.has(e.slug)) return false;
  return true;
};

watch(
  () => props.entries,
  (incoming) => {
    if (sameSlugs(stableEntries.value, incoming)) {
      const bySlug = new Map(incoming.map((e) => [e.slug, e] as const));
      stableEntries.value = stableEntries.value
        .map((e) => bySlug.get(e.slug))
        .filter((e): e is ListFavoriteState => e !== undefined);
    } else {
      stableEntries.value = [...incoming];
    }
  },
  { deep: false },
);

const groups = computed<Array<[Category, ListFavoriteState[]]>>(() =>
  groupCatalogByCategory(stableEntries.value, (c) => t(CATEGORIES[c].labelKey), locale.value),
);
</script>

<template>
  <div v-if="stableEntries.length > 0" data-testid="favorites-panel" class="space-y-3">
    <section
      v-for="[category, items] in groups"
      :key="category"
      :data-testid="`shelf-group-${category}`"
    >
      <h3
        class="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-gray font-medium mb-1.5"
        :data-testid="`shelf-group-title-${category}`"
      >
        <span aria-hidden="true" :style="{ color: CATEGORIES[category].cssVar }">{{ CATEGORIES[category].icon }}</span>
        <span>{{ t(CATEGORIES[category].labelKey) }}</span>
      </h3>
      <TransitionGroup name="shelf-tile" tag="div" class="grid grid-cols-2 gap-2">
            <ShelfTile
              v-for="entry in items"
              :key="entry.slug"
              :entry="entry"
              :is-top="topSlugs.has(entry.slug)"
              :in-list="props.presenceKeys?.has(favoritePresenceKey(entry.slug, entry.category)) ?? false"
              @add="onAdd"
              @exclude="onExclude"
            />
      </TransitionGroup>
    </section>
  </div>
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
