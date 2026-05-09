import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';
import MostUsedShelf from '@/components/list/MostUsedShelf.vue';
import type { CatalogEntry } from '@/domain/types';
import { newId } from '@/domain/id';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
});

const makeEntry = (
  name: string,
  usageCount: number,
  lastUsedAt: number,
): CatalogEntry => ({
  id: newId(),
  ownerUid: 'uid',
  name,
  category: 'other',
  usageCount,
  lastUsedAt,
});

const NOW = Date.now();
const entries: CatalogEntry[] = [
  makeEntry('Latte', 20, NOW - 1 * 86400000),
  makeEntry('Pane', 15, NOW - 2 * 86400000),
  makeEntry('Uova', 10, NOW - 3 * 86400000),
  makeEntry('Burro', 5, NOW - 4 * 86400000),
  makeEntry('Pasta', 18, NOW - 1 * 86400000),
];

describe('MostUsedShelf', () => {
  test('renders shelf container', () => {
    const w = mount(MostUsedShelf, {
      props: { entries },
      global: { plugins: [i18n] },
    });
    expect(w.find('.shelf').exists()).toBe(true);
  });

  test('renders correct number of cells', () => {
    const w = mount(MostUsedShelf, {
      props: { entries },
      global: { plugins: [i18n] },
    });
    expect(w.findAll('.shelf__cell')).toHaveLength(entries.length);
  });

  test('marks top 20% with data-rank=top', () => {
    const w = mount(MostUsedShelf, {
      props: { entries },
      global: { plugins: [i18n] },
    });
    const topCells = w.findAll('[data-rank="top"]');
    expect(topCells.length).toBe(Math.ceil(entries.length * 0.2));
  });

  test('marks added entries with data-added', () => {
    const w = mount(MostUsedShelf, {
      props: { entries, addedNames: ['Latte'] },
      global: { plugins: [i18n] },
    });
    const addedCells = w.findAll('[data-added]');
    expect(addedCells.length).toBe(1);
  });

  test('emits add when non-added cell clicked', async () => {
    const w = mount(MostUsedShelf, {
      props: { entries, addedNames: [] },
      global: { plugins: [i18n] },
    });
    const cells = w.findAll('.shelf__cell:not([data-added])');
    await cells[0]!.trigger('click');
    expect(w.emitted('add')).toBeTruthy();
    expect(w.emitted('add')![0]![0]).toHaveProperty('name');
  });

  test('shows empty state when no entries', () => {
    const w = mount(MostUsedShelf, {
      props: { entries: [] },
      global: { plugins: [i18n] },
    });
    expect(w.find('.shelf__cell').exists()).toBe(false);
    expect(w.find('.label').exists()).toBe(true);
  });
});
