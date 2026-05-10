<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useListsStore } from '@/stores/lists';
import type { ULID } from '@/domain/id';
import EmptyState from '@/components/ui/EmptyState.vue';
import Button from '@/components/ui/Button.vue';
import IconTrash from '@/components/ui/icons/IconTrash.vue';

const { t } = useI18n();
const router = useRouter();
const lists = useListsStore();

const handleRestore = (id: ULID): void => {
  lists.restore(id);
};

const goHome = (): void => {
  router.push('/');
};
</script>

<template>
  <div
    class="trash-view"
    data-view="TrashView"
  >
    <header class="trash-view__header appbar">
      <button
        type="button"
        class="iconbtn"
        :aria-label="t('list.back')"
        @click="goHome"
      >
        <IconTrash :size="20" />
      </button>
      <h1 class="trash-view__title">
        {{ t('trash.title') }}
      </h1>
    </header>

    <p class="trash-view__retention label">
      {{ t('trash.retentionNote') }}
    </p>

    <EmptyState v-if="lists.trash.length === 0">
      <template #title>
        {{ t('trash.empty') }}
      </template>
    </EmptyState>

    <ul
      v-else
      class="trash-view__list"
    >
      <li
        v-for="list in lists.trash"
        :key="list.id"
        class="trash-view__item row-card"
      >
        <span class="trash-view__name">{{ list.name }}</span>
        <Button
          variant="ghost"
          data-testid="restore-btn"
          @click="handleRestore(list.id)"
        >
          {{ t('trash.restore') }}
        </Button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.trash-view {
  min-height: 100dvh;
  background: var(--cream);
  padding: var(--space-4) var(--space-5);
}

.trash-view__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.trash-view__title {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.trash-view__retention {
  margin: 0 0 var(--space-6);
  color: var(--ink-40);
}

.trash-view__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.trash-view__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--offwhite);
  border-radius: var(--radius-md);
}

.trash-view__name {
  font-weight: 500;
  color: var(--charcoal);
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
