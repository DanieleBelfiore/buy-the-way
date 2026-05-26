import { defineStore } from 'pinia';
import { ref } from 'vue';
import { subscribeCatalog } from '@/services/catalog.service';
import {
  PUBLIC_CATALOG,
  getPublicCatalogName,
  normalizeName,
} from '@/domain/public-catalog';
import type { CatalogEntry, Category } from '@/domain/types';

export interface Suggestion {
  readonly key: string;
  readonly name: string;
  readonly category: Category;
  readonly source: 'user' | 'public';
  readonly icon?: string;
  readonly usageCount?: number;
}

/**
 * Per-user, cross-list catalog used to power autocomplete suggestions.
 * Per-list favorite shelf state (pinned/excluded/dismissedFavorite) lives in
 * `useListFavoritesStore`; this store no longer carries any of those flags.
 */
export const useCatalogStore = defineStore('catalog', () => {
  const entries = ref<CatalogEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let _unsubscribe: (() => void) | null = null;

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

  /**
   * Resolve a category from a raw, free-text item name. Used by the bulk-paste
   * flow to give each pasted row a best-guess category without forcing the
   * user to set one manually.
   *
   * Order of preference:
   *  1. Exact (normalized) match in the user's catalog
   *  2. Exact match in the public catalog for the given locale
   *  3. Fallback to `other`
   */
  const inferCategoryForName = (name: string, locale: string): Category => {
    const norm = normalizeName(name);
    if (!norm) return 'other';
    const userMatch = entries.value.find((e) => normalizeName(e.name) === norm);
    if (userMatch) return userMatch.category;
    const publicMatch = PUBLIC_CATALOG.find(
      (e) => normalizeName(getPublicCatalogName(e, locale)) === norm,
    );
    if (publicMatch) return publicMatch.category;
    return 'other';
  };

  const suggestionsFor = (query: string, locale: string, limit = 12): Suggestion[] => {
    const normQ = normalizeName(query);
    const seen = new Set<string>();
    const result: Suggestion[] = [];

    const userPool = entries.value
      .slice()
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);

    for (const e of userPool) {
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
    subscribe,
    suggestionsFor,
    inferCategoryForName,
  };
});
