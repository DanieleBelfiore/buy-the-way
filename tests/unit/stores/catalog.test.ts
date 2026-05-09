import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';

describe('stores/catalog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.signOut();
    auth.signIn();
  });

  it('seeds entries from fixtures', () => {
    const catalog = useCatalogStore();
    expect(catalog.entries.length).toBeGreaterThanOrEqual(20);
  });

  it('recordUse creates a new entry on first use, then increments usageCount', () => {
    const catalog = useCatalogStore();
    catalog.reset();
    const before = catalog.entries.length;
    catalog.recordUse('Mango', 'fruit_vegetables');
    expect(catalog.entries.length).toBe(before + 1);
    const created = catalog.entries.find(
      (e) => e.name.toLowerCase() === 'mango' && e.category === 'fruit_vegetables',
    );
    expect(created).toBeDefined();
    expect(created?.usageCount).toBe(1);
    expect(created?.ownerUid).toBe('mock-uid');

    catalog.recordUse('Mango', 'fruit_vegetables');
    const second = catalog.entries.find(
      (e) => e.name.toLowerCase() === 'mango' && e.category === 'fruit_vegetables',
    );
    expect(second?.usageCount).toBe(2);
    expect(catalog.entries.length).toBe(before + 1);
  });

  it('recordUse matches names case-insensitively', () => {
    const catalog = useCatalogStore();
    catalog.reset();
    catalog.recordUse('Kiwi', 'fruit_vegetables');
    catalog.recordUse('kiwi', 'fruit_vegetables');
    catalog.recordUse('KIWI', 'fruit_vegetables');
    const hits = catalog.entries.filter(
      (e) => e.name.toLowerCase() === 'kiwi' && e.category === 'fruit_vegetables',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]?.usageCount).toBe(3);
  });

  it('recordUse ignores blank names', () => {
    const catalog = useCatalogStore();
    catalog.reset();
    const before = catalog.entries.length;
    catalog.recordUse('   ', 'other');
    catalog.recordUse('', 'other');
    expect(catalog.entries.length).toBe(before);
  });

  it('ranked sorts entries by recency-weighted score (descending)', () => {
    const catalog = useCatalogStore();
    catalog.reset();
    const now = Date.now();
    catalog.recordUse('FreshHot', 'other');
    const ranked = catalog.ranked(now);
    expect(ranked.length).toBe(catalog.entries.length);
    const first = ranked[0];
    expect(first).toBeDefined();
    expect(first?.usageCount).toBeGreaterThan(0);
  });
});
