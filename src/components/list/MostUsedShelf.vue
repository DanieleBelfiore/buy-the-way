<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Star } from '@lucide/vue';
import ShelfTile from '@/components/list/ShelfTile.vue';
import { CATEGORIES } from '@/domain/categories';
import { groupCatalogByCategory } from '@/domain/sort';
import type { Category, ListFavoriteState } from '@/domain/types';

const props = defineProps<{
  entries: ListFavoriteState[];
  topSlugs: Set<string>;
}>();

const emit = defineEmits<{
  'add-from-shelf': [ListFavoriteState];
  'exclude-tile': [ListFavoriteState];
}>();

const { t, locale } = useI18n();

const collapsed = ref(true);

const toggle = () => {
  collapsed.value = !collapsed.value;
};

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

// Smooth height-based collapse, identical to CategorySection's cat-collapse
// transition (categories vs favorites parity).
const beforeEnter = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = '0px';
  node.style.opacity = '0';
};
const onEnter = (el: Element, done: () => void): void => {
  const node = el as HTMLElement;
  requestAnimationFrame(() => {
    node.style.height = `${node.scrollHeight}px`;
    node.style.opacity = '1';
  });
  node.addEventListener('transitionend', done, { once: true });
};
const afterEnter = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = '';
  node.style.opacity = '';
};
const beforeLeave = (el: Element): void => {
  const node = el as HTMLElement;
  node.style.height = `${node.scrollHeight}px`;
  node.style.opacity = '1';
};
const onLeave = (el: Element, done: () => void): void => {
  const node = el as HTMLElement;
  requestAnimationFrame(() => {
    node.style.height = '0px';
    node.style.opacity = '0';
  });
  node.addEventListener('transitionend', done, { once: true });
};
</script>

<template>
  <section
    v-if="stableEntries.length > 0"
    data-testid="favorites-section"
    class="mx-3 mt-3 mb-2 px-4 pt-3 pb-2 rounded-2xl border border-favorite-gold/40 bg-favorite-gold-soft/30"
  >
    <button
      type="button"
      data-testid="shelf-toggle"
      :aria-label="collapsed ? t('shelf.expand') : t('shelf.collapse')"
      :aria-expanded="!collapsed"
      class="w-full flex items-center justify-between mb-2 cursor-pointer select-none text-left"
      @click="toggle"
    >
      <h2
        data-testid="shelf-title"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal tracking-tight"
      >
        <Star :size="14" :stroke-width="2" fill="currentColor" aria-hidden="true" />
        <span>{{ t('shelf.title', stableEntries.length, { count: stableEntries.length }) }}</span>
      </h2>
      <span
        class="flex items-center justify-center w-8 h-8 rounded-full text-muted-gray"
        aria-hidden="true"
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
      </span>
    </button>

    <Transition
      name="shelf-collapse"
      @before-enter="beforeEnter"
      @enter="onEnter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="onLeave"
    >
      <div v-if="!collapsed" class="shelf-collapse-inner space-y-3">
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
              @add="onAdd"
              @exclude="onExclude"
            />
          </TransitionGroup>
        </section>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.shelf-collapse-inner {
  overflow: hidden;
  transition: height 240ms ease, opacity 200ms ease;
}
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
  .shelf-collapse-inner,
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
