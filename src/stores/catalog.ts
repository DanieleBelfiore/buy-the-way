import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { subscribeCatalog } from '@/services/catalog.service';
import { rankCatalog } from '@/domain/ranking';
import {
  PUBLIC_CATALOG,
  getPublicCatalogName,
  normalizeName,
} from '@/domain/public-catalog';
import type { CatalogEntry, Category } from '@/domain/types';
import type { ULID } from '@/domain/id';

export interface Suggestion {
  readonly key: string;
  readonly name: string;
  readonly category: Category;
  readonly source: 'user' | 'public';
  readonly icon?: string;
  readonly usageCount?: number;
}

export const useCatalogStore = defineStore('catalog', () => {
  const entries = ref<CatalogEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let _unsubscribe: (() => void) | null = null;

  const rankedEntries = computed(() => rankCatalog(entries.value, Date.now()));

  const topIds = computed<Set<ULID>>(
    () => new Set(rankedEntries.value.slice(0, 2).map((e) => e.id)),
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

  const suggestionsFor = (query: string, locale: string, limit = 12): Suggestion[] => {
    const normQ = normalizeName(query);
    const seen = new Set<string>();
    const result: Suggestion[] = [];

    for (const e of rankedEntries.value) {
      const norm = normalizeName(e.name);
      if (normQ && !norm.includes(normQ)) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      result.push({
        key: `u:${e.id}`,
        name: e.name,
        category: e.category,
        source: 'user',
        usageCount: e.usageCount,
      });
    }

    for (const e of PUBLIC_CATALOG) {
      const localizedName = getPublicCatalogName(e, locale);
      const norm = normalizeName(localizedName);
      if (seen.has(norm)) continue;
      if (normQ && !norm.includes(normQ)) continue;
      seen.add(norm);
      result.push({
        key: `p:${e.slug}`,
        name: localizedName,
        category: e.category,
        source: 'public',
        icon: e.icon,
      });
    }

    if (normQ) {
      result.sort((a, b) => {
        const aNorm = normalizeName(a.name);
        const bNorm = normalizeName(b.name);
        const aExact = aNorm === normQ ? 0 : 1;
        const bExact = bNorm === normQ ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aPrefix = aNorm.startsWith(normQ) ? 0 : 1;
        const bPrefix = bNorm.startsWith(normQ) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
        return (b.usageCount ?? 0) - (a.usageCount ?? 0);
      });
    }

    return result.slice(0, limit);
  };

  return {
    entries,
    loading,
    error,
    rankedEntries,
    topIds,
    subscribe,
    suggestFor,
    suggestionsFor,
  };
});
