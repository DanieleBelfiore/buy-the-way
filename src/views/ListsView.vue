<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useListsStore } from '@/stores/lists';
import { useItemsStore } from '@/stores/items';
import { useLastVisit } from '@/composables/useLastVisit';
import type { ULID } from '@/domain/id';
import ListCard from '@/components/list/ListCard.vue';
import NewListSheet from '@/components/list/NewListSheet.vue';
import FAB from '@/components/ui/FAB.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import IconPlus from '@/components/ui/icons/IconPlus.vue';
import IconSettings from '@/components/ui/icons/IconSettings.vue';
import IconTrash from '@/components/ui/icons/IconTrash.vue';

const { t } = useI18n();
const router = useRouter();
const lists = useListsStore();
const items = useItemsStore();
const { isNew, recordVisit } = useLastVisit();

const showNewListSheet = ref(false);

const sortedActive = computed(() =>
  [...lists.active].sort((a, b) => b.updatedAt - a.updatedAt),
);

onMounted(() => {
  recordVisit();
});

const navigateToList = (id: ULID): void => {
  router.push(`/lists/${id}`);
};

const handleCreateList = (name: string): void => {
  const id = lists.create(name);
  showNewListSheet.value = false;
  router.push(`/lists/${id}`);
};
</script>

<template>
  <div class="lists-view" data-view="ListsView">
    <header class="lists-view__header appbar">
      <h1 class="lists-view__title">{{ t('home.title') }}</h1>
      <div class="lists-view__header-actions">
        <router-link to="/settings" class="iconbtn" :aria-label="t('settings.account')">
          <IconSettings :size="22" />
        </router-link>
      </div>
    </header>

    <EmptyState v-if="sortedActive.length === 0">
      <template #title>{{ t('home.empty') }}</template>
    </EmptyState>

    <ul v-else class="lists-view__grid">
      <li v-for="list in sortedActive" :key="list.id">
        <ListCard
          :list="list"
          :items="items.forList(list.id)"
          :is-new="isNew(list.createdAt)"
          @click="navigateToList(list.id)"
        />
      </li>
    </ul>

    <div class="lists-view__footer">
      <router-link
        to="/trash"
        class="chip chip--default"
        data-testid="trash-link"
      >
        <IconTrash :size="16" />
        {{ t('home.trash') }}
        <span v-if="lists.trash.length > 0" class="lists-view__trash-count">
          {{ lists.trash.length }}
        </span>
      </router-link>
    </div>

    <FAB
      :ariaLabel="t('home.fab')"
      data-testid="new-list-fab"
      @click="showNewListSheet = true"
    >
      <IconPlus :size="24" />
    </FAB>

    <NewListSheet
      v-if="showNewListSheet"
      @submit="handleCreateList"
      @cancel="showNewListSheet = false"
    />
  </div>
</template>

<style scoped>
.lists-view {
  min-height: 100dvh;
  background: var(--cream);
  padding: var(--space-4) var(--space-5) var(--space-20);
}

.lists-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.lists-view__title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--charcoal);
  margin: 0;
}

.lists-view__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.lists-view__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.lists-view__footer {
  display: flex;
  justify-content: center;
  margin-top: var(--space-8);
}

.lists-view__trash-count {
  background: var(--charcoal);
  color: var(--cream);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 0 var(--space-2);
  min-width: 18px;
  text-align: center;
}
</style>
