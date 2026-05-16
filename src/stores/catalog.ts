import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { subscribeCatalog } from '@/services/catalog.service';
import { rankCatalog } from '@/domain/ranking';
import type { CatalogEntry } from '@/domain/types';

export const useCatalogStore = defineStore('catalog', () => {
  const entries = ref<CatalogEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let _unsubscribe: (() => void) | null = null;

  const rankedEntries = computed(() =>
    rankCatalog(entries.value, Date.now()).slice(0, 24),
  );

  const subscribe = (ownerUid: string): (() => void) => {
    _unsubscribe?.();
    loading.value = true;
    _unsubscribe = subscribeCatalog(
      ownerUid,
      (incoming) => {
        entries.value = incoming;
        loading.value = false;
      },
      (err) => {
        error.value = err.message;
        loading.value = false;
      },
    );
    return () => {
      _unsubscribe?.();
      _unsubscribe = null;
    };
  };

  const suggestFor = (query: string): CatalogEntry[] => {
    const q = query.trim().toLowerCase();
    if (!q) return rankedEntries.value;
    return rankedEntries.value.filter((e) => e.name.toLowerCase().startsWith(q));
  };

  return { entries, loading, error, rankedEntries, subscribe, suggestFor };
});
