/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { newId } from '@/domain/id';
import { rankByRecency } from '@/domain/ranking';
import type { CatalogEntry, Category } from '@/domain/types';
import { FIXTURE_CATALOG } from '@/dev/fixtures';
import { useAuthStore } from './auth';
import { recordCatalogUse, subscribeCatalog } from '@/services/catalog.service';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

interface CatalogStoreApi {
  readonly entries: Ref<readonly CatalogEntry[]>;
  readonly ranked: ComputedRef<(now: number) => readonly CatalogEntry[]>;
  subscribe: (uid: string) => () => void;
  recordUse: (name: string, cat: Category) => void;
  reset: () => void;
}

const FALLBACK_OWNER = 'mock-uid';

const cloneFixtures = (): CatalogEntry[] => FIXTURE_CATALOG.map((e) => ({ ...e }));

export const useCatalogStore = defineStore('catalog', (): CatalogStoreApi => {
  const entries: Ref<readonly CatalogEntry[]> = ref(USE_FIXTURES ? cloneFixtures() : []);

  let _unsub: (() => void) | null = null;

  const subscribe = (uid: string): (() => void) => {
    if (USE_FIXTURES) return () => {};
    _unsub?.();
    _unsub = subscribeCatalog(uid, (fetched) => {
      entries.value = fetched;
    });
    return () => {
      _unsub?.();
      _unsub = null;
    };
  };

  const recordUse = (name: string, cat: Category): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;

    if (!USE_FIXTURES) {
      const auth = useAuthStore();
      const ownerUid = auth.currentUser?.uid ?? FALLBACK_OWNER;
      recordCatalogUse(ownerUid, trimmed, cat).catch(console.error);
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
    _unsub?.();
    _unsub = null;
    entries.value = USE_FIXTURES ? cloneFixtures() : [];
  };

  return { entries, ranked, subscribe, recordUse, reset };
});
