<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CatalogEntry } from '@/domain/types';
import { rankByRecency } from '@/domain/ranking';
import CategoryIcon from '@/components/ui/CategoryIcon.vue';

interface Props {
  entries: readonly CatalogEntry[];
  addedNames?: readonly string[];
}

const props = withDefaults(defineProps<Props>(), {
  addedNames: () => [] as readonly string[],
});

const emit = defineEmits<{
  (e: 'add', entry: CatalogEntry): void;
}>();

const { t } = useI18n();

const ranked = computed((): readonly CatalogEntry[] =>
  rankByRecency(props.entries, Date.now()),
);

const topCount = computed((): number =>
  Math.ceil(ranked.value.length * 0.2),
);

const addedSet = computed((): ReadonlySet<string> =>
  new Set(props.addedNames),
);

const isTop = (idx: number): boolean => idx < topCount.value;
const isAdded = (entry: CatalogEntry): boolean => addedSet.value.has(entry.name);

const onCellClick = (entry: CatalogEntry): void => {
  if (isAdded(entry)) return;
  emit('add', entry);
};
</script>

<template>
  <div v-if="ranked.length === 0" class="shelf-empty">
    <p class="label">{{ t('list.mostUsedHelp') }}</p>
  </div>
  <div v-else class="shelf" role="list" :aria-label="t('list.mostUsed')">
    <button
      v-for="(entry, idx) in ranked"
      :key="entry.id"
      type="button"
      class="shelf__cell"
      role="listitem"
      :data-rank="isTop(idx) ? 'top' : undefined"
      :data-added="isAdded(entry) ? '' : undefined"
      :aria-disabled="isAdded(entry) || undefined"
      :tabindex="isAdded(entry) ? -1 : 0"
      @click="onCellClick(entry)"
    >
      <CategoryIcon :category="entry.category" :size="16" />
      <span class="shelf__name">{{ entry.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.shelf-empty {
  padding: var(--space-4);
  background: var(--ink-03);
  border-radius: var(--radius-md);
  text-align: center;
}

.shelf__cell {
  font: inherit;
  cursor: pointer;
}

.shelf__name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
