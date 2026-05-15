<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useListsStore } from '@/stores/lists';
import ListCard from '@/components/list/ListCard.vue';
import FAB from '@/components/ui/FAB.vue';

const { t } = useI18n();
const router = useRouter();
const listsStore = useListsStore();

const showCreateInput = ref(false);
const newListName = ref('');
const creating = ref(false);
const createError = ref<string | null>(null);

let unsubscribe: (() => void) | undefined;

onMounted(() => {
  unsubscribe = listsStore.subscribe();
});

onUnmounted(() => {
  unsubscribe?.();
});

const openCreateInput = () => {
  showCreateInput.value = true;
  newListName.value = '';
};

const cancelCreate = () => {
  showCreateInput.value = false;
  newListName.value = '';
};

const submitCreate = async () => {
  const name = newListName.value.trim();
  if (!name) return;
  creating.value = true;
  createError.value = null;
  try {
    await listsStore.createList(name);
    showCreateInput.value = false;
    newListName.value = '';
  } catch (err) {
    createError.value = err instanceof Error ? err.message : String(err);
  } finally {
    creating.value = false;
  }
};

const openList = (id: string) => {
  router.push({ name: 'list-detail', params: { id } });
};
</script>

<template>
  <main class="min-h-screen bg-cream pb-24">
    <!-- Header -->
    <header class="px-5 pt-12 pb-4 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">
        {{ t('app.name') }}
      </h1>
      <button
        aria-label="Settings"
        class="flex items-center justify-center w-10 h-10 rounded-full text-muted-gray hover:bg-black/5 active:bg-black/10"
        @click="router.push({ name: 'settings' })"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </header>

    <!-- Create input (inline, appears when FAB tapped) -->
    <div v-if="showCreateInput" class="px-5 mb-4">
      <p v-if="createError" class="text-red-500 text-xs mb-2">{{ createError }}</p>
      <div class="flex gap-2">
        <input
          v-model="newListName"
          :aria-label="t('list.newPlaceholder')"
          :placeholder="t('list.newPlaceholder')"
          class="flex-1 px-4 py-3 bg-offwhite border border-cream-soft rounded-xl
                 text-sm text-charcoal placeholder-muted-gray
                 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          autofocus
          @keydown.enter="submitCreate"
          @keydown.escape="cancelCreate"
        />
        <button
          :disabled="creating || !newListName.trim()"
          class="px-4 py-3 bg-charcoal text-offwhite text-sm font-medium rounded-xl
                 disabled:opacity-40"
          @click="submitCreate"
        >
          {{ t('list.create') }}
        </button>
        <button
          class="px-3 py-3 text-muted-gray text-sm"
          @click="cancelCreate"
        >
          {{ t('list.cancel') }}
        </button>
      </div>
    </div>

    <!-- List of cards -->
    <section class="px-5 space-y-3">
      <template v-if="listsStore.loading">
        <!-- Loading skeleton -->
        <div
          v-for="i in 3"
          :key="i"
          class="h-14 bg-offwhite rounded-2xl animate-pulse"
        />
      </template>

      <template v-else-if="listsStore.error">
        <!-- Error state -->
        <div class="text-center pt-16 space-y-2">
          <p class="text-red-500 text-sm">{{ listsStore.error }}</p>
        </div>
      </template>

      <template v-else-if="listsStore.lists.length === 0">
        <!-- Empty state -->
        <div class="text-center pt-16 space-y-2">
          <p class="text-charcoal font-medium">{{ t('list.noLists') }}</p>
          <p class="text-sm text-muted-gray">{{ t('list.noListsHint') }}</p>
        </div>
      </template>

      <template v-else>
        <ListCard
          v-for="list in listsStore.lists"
          :key="list.id"
          :list="list"
          @open="openList"
        />
      </template>
    </section>

    <!-- FAB -->
    <FAB v-if="!showCreateInput" @click="openCreateInput" />
  </main>
</template>
