/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { newId } from '@/domain/id';
import { rankByRecency } from '@/domain/ranking';
import type { CatalogEntry, Category } from '@/domain/types';
import { FIXTURE_CATALOG } from '@/dev/fixtures';
import { useAuthStore } from './auth';

interface CatalogStoreApi {
  readonly entries: Ref<readonly CatalogEntry[]>;
  readonly ranked: ComputedRef<(now: number) => readonly CatalogEntry[]>;
  recordUse: (name: string, cat: Category) => void;
  reset: () => void;
}

const FALLBACK_OWNER = 'mock-uid';

const cloneFixtures = (): CatalogEntry[] => FIXTURE_CATALOG.map((e) => ({ ...e }));

/**
 * Per-user product catalog backing the {@link MostUsedShelf}. Phase 1 keeps
 * the entries in memory seeded from {@link FIXTURE_CATALOG}; Phase 4 will
 * replace the seed with a Firestore subscription scoped to the auth store's
 * current user.
 */
export const useCatalogStore = defineStore('catalog', (): CatalogStoreApi => {
  const entries: Ref<readonly CatalogEntry[]> = ref(cloneFixtures());

  const recordUse = (name: string, cat: Category): void => {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    const now = Date.now();
    const lower = trimmed.toLowerCase();
    const existing = entries.value.find(
      (e) => e.name.toLowerCase() === lower && e.category === cat,
    );
    if (existing) {
      entries.value = entries.value.map((e) =>
        e === existing ? { ...e, usageCount: e.usageCount + 1, lastUsedAt: now } : e,
      );
      return;
    }
    const auth = useAuthStore();
    const ownerUid = auth.currentUser?.uid ?? FALLBACK_OWNER;
    const fresh: CatalogEntry = {
      id: newId(),
      ownerUid,
      name: trimmed,
      category: cat,
      usageCount: 1,
      lastUsedAt: now,
    };
    entries.value = [...entries.value, fresh];
  };

  const ranked = computed(
    () =>
      (now: number): readonly CatalogEntry[] =>
        rankByRecency(entries.value, now),
  );

  const reset = (): void => {
    entries.value = cloneFixtures();
  };

  return { entries, ranked, recordUse, reset };
});
