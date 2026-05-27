<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import { useListsStore } from '@/stores/lists';
import { useCatalogStore } from '@/stores/catalog';
import { useSafeBack } from '@/composables/useSafeBack';
import { FAVORITES_MIN_USES } from '@/domain/ranking';
import {
  topUsedItems,
  categoryBreakdown,
  computeTotals,
} from '@/domain/stats';
import TopItemsChart from '@/components/stats/TopItemsChart.vue';
import CategoryDonut from '@/components/stats/CategoryDonut.vue';

const { t } = useI18n();
const authStore = useAuthStore();
const listsStore = useListsStore();
const catalogStore = useCatalogStore();
const safeBack = useSafeBack();
const handleBack = (): void => safeBack({ name: 'lists' });

const entries = computed(() => catalogStore.entries);
const lists = computed(() => listsStore.lists);

const top = computed(() => topUsedItems(entries.value, 10));
const slices = computed(() => categoryBreakdown(entries.value));
const totals = computed(() =>
  computeTotals(
    entries.value,
    lists.value,
    authStore.user?.uid ?? null,
    FAVORITES_MIN_USES,
  ),
);

const hasData = computed(() => totals.value.totalUsage > 0);
const loading = computed(
  () => catalogStore.loading || (listsStore.loading && lists.value.length === 0),
);

let _listsUnsub: (() => void) | null = null;
let _catalogUnsub: (() => void) | null = null;

onMounted(() => {
  _listsUnsub = listsStore.subscribe();
  if (authStore.user) {
    _catalogUnsub = catalogStore.subscribe(authStore.user.uid);
  }
});

onUnmounted(() => {
  _listsUnsub?.();
  _catalogUnsub?.();
});

const totalCards = computed(() => [
  { key: 'lists', label: t('stats.totals.lists'), value: totals.value.listsCount },
  {
    key: 'collaborators',
    label: t('stats.totals.collaborators'),
    value: totals.value.uniqueCollaborators,
  },
  { key: 'catalog', label: t('stats.totals.catalog'), value: totals.value.catalogEntries },
  { key: 'favorites', label: t('stats.totals.favorites'), value: totals.value.favorites },
  {
    key: 'totalUsage',
    label: t('stats.totals.totalUsage'),
    value: totals.value.totalUsage,
  },
]);
</script>

<template>
  <main
    class="min-h-dvh bg-cream flex flex-col"
    style="padding-bottom: max(2rem, env(safe-area-inset-bottom));"
  >
    <header class="px-5 pt-6 pb-4 flex items-center gap-3">
      <button
        :aria-label="t('stats.title')"
        class="flex items-center justify-center w-10 h-10 rounded-full text-charcoal"
        @click="handleBack"
      >
        <ArrowLeft :size="22" :stroke-width="2.5" aria-hidden="true" />
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">
        {{ t('stats.title') }}
      </h1>
    </header>

    <div v-if="loading" class="px-5 py-12 text-center text-muted-gray text-sm">
      {{ t('stats.loading') }}
    </div>

    <div
      v-else-if="!hasData"
      data-testid="stats-empty"
      class="px-5 py-16 text-center text-sm text-muted-gray"
    >
      {{ t('stats.empty') }}
    </div>

    <div v-else class="px-5 space-y-6">
      <section
        data-testid="stats-totals"
        class="grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        <div
          v-for="card in totalCards"
          :key="card.key"
          :data-testid="`stats-total-${card.key}`"
          class="bg-offwhite rounded-xl border border-cream-soft px-4 py-3"
        >
          <div class="text-2xl font-semibold text-charcoal tabular-nums">
            {{ card.value }}
          </div>
          <div class="text-xs text-muted-gray mt-1">{{ card.label }}</div>
        </div>
      </section>

      <section v-if="top.length > 0" data-testid="stats-top-items" class="space-y-2">
        <header>
          <h2 class="text-base font-semibold text-charcoal">
            {{ t('stats.topItems.title') }}
          </h2>
          <p class="text-xs text-muted-gray">{{ t('stats.topItems.subtitle') }}</p>
        </header>
        <div class="bg-offwhite rounded-xl border border-cream-soft p-4">
          <TopItemsChart :items="top" />
        </div>
      </section>

      <section v-if="slices.length > 0" data-testid="stats-categories" class="space-y-2">
        <header>
          <h2 class="text-base font-semibold text-charcoal">
            {{ t('stats.categories.title') }}
          </h2>
          <p class="text-xs text-muted-gray">{{ t('stats.categories.subtitle') }}</p>
        </header>
        <div class="bg-offwhite rounded-xl border border-cream-soft p-4">
          <CategoryDonut :slices="slices" />
        </div>
      </section>
    </div>
  </main>
</template>
