<script setup lang="ts">
import { computed } from 'vue';
import type { List, Item } from '@/domain/types';
import AvatarStack from '@/components/ui/AvatarStack.vue';

interface Props {
  list: List;
  items?: readonly Item[];
  isNew?: boolean;
  memberNames?: readonly string[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  isNew: false,
  memberNames: () => [],
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

const checkedCount = computed(() => props.items.filter((i) => i.checked).length);
const totalCount = computed(() => props.items.length);
const progress = computed(() =>
  totalCount.value > 0 ? checkedCount.value / totalCount.value : 0,
);
const previewItems = computed(() => props.items.slice(0, 3));
</script>

<template>
  <article
    class="list-card row-card"
    data-testid="list-card"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
    @keydown.space.prevent="emit('click')"
  >
    <header class="list-card__header">
      <h2 class="list-card__name">{{ list.name }}</h2>
      <span v-if="isNew" class="chip chip--dark list-card__badge">Nuovo</span>
    </header>

    <div class="list-card__meta">
      <AvatarStack v-if="memberNames.length > 0" :names="[...memberNames]" />
      <span class="list-card__count label">{{ totalCount }} articoli</span>
    </div>

    <ul v-if="previewItems.length > 0" class="list-card__preview" aria-hidden="true">
      <li v-for="item in previewItems" :key="item.id" class="list-card__preview-item label">
        {{ item.name }}
      </li>
    </ul>

    <div v-if="totalCount > 0" class="list-card__progress" aria-hidden="true">
      <div class="list-card__progress-bar" :style="{ width: `${progress * 100}%` }" />
    </div>
  </article>
</template>

<style scoped>
.list-card {
  cursor: pointer;
  user-select: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--offwhite);
  border-radius: var(--radius-md);
  transition: box-shadow 150ms ease;
}

.list-card:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.list-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.list-card__name {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card__badge {
  flex-shrink: 0;
  font-size: var(--text-xs);
}

.list-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.list-card__count {
  color: var(--ink-40);
}

.list-card__preview {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.list-card__preview-item {
  color: var(--ink-82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-card__progress {
  height: 3px;
  background: var(--cream-soft);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.list-card__progress-bar {
  height: 100%;
  background: var(--charcoal);
  border-radius: var(--radius-pill);
  transition: width 300ms ease;
}
</style>
