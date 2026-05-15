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
  try {
    await listsStore.createList(name);
    showCreateInput.value = false;
    newListName.value = '';
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
    </header>

    <!-- Create input (inline, appears when FAB tapped) -->
    <div v-if="showCreateInput" class="px-5 mb-4">
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
