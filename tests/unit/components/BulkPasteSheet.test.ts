import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import BulkPasteSheet from '@/components/list/BulkPasteSheet.vue';
import type { Category } from '@/domain/types';

const messages = {
  en: {
    item: {
      bulkPaste: 'Paste a list',
      bulkPasteTitle: 'Paste many items',
      bulkPasteHint: 'One per line.',
      bulkPastePlaceholder: 'Milk\nBread',
      bulkPasteCount: 'No items | Add 1 item | Add {n} items',
    },
    list: { cancel: 'Cancel' },
  },
};

const buildI18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages });

const mountSheet = (overrides?: { open?: boolean; inferCategory?: (n: string) => Category }) =>
  mount(BulkPasteSheet, {
    props: {
      open: overrides?.open ?? true,
      inferCategory: overrides?.inferCategory ?? (() => 'other' as Category),
    },
    global: { plugins: [buildI18n()] },
  });

describe('BulkPasteSheet', () => {
  beforeEach(() => {
    // Modal uses useModalBack which schedules history.back on unmount when it
    // owns state. Mock to keep jsdom happy + avoid noisy navigation calls.
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'back').mockImplementation(() => {});
    history.replaceState(null, '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when open=false', () => {
    const wrapper = mountSheet({ open: false });
    expect(wrapper.find('[data-testid="bulk-paste-textarea"]').exists()).toBe(false);
  });

  it('shows no preview rows when textarea is blank', () => {
    const wrapper = mountSheet();
    expect(wrapper.find('[data-testid="bulk-paste-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="bulk-paste-row"]').exists()).toBe(false);
  });

  it('splits on newlines and shows one preview row per non-empty token', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="bulk-paste-textarea"]').setValue('Milk\nBread\n\nEggs');
    const rows = wrapper.findAll('[data-testid="bulk-paste-row"]');
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain('Milk');
    expect(rows[1].text()).toContain('Bread');
    expect(rows[2].text()).toContain('Eggs');
  });

  it('also splits on commas', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="bulk-paste-textarea"]').setValue('milk, bread, eggs');
    expect(wrapper.findAll('[data-testid="bulk-paste-row"]')).toHaveLength(3);
  });

  it('trims tokens and drops empties', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="bulk-paste-textarea"]').setValue('  milk  ,\n,\n   ,bread');
    const rows = wrapper.findAll('[data-testid="bulk-paste-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('milk');
    expect(rows[1].text()).toContain('bread');
  });

  it('disables Submit when there are no rows', () => {
    const wrapper = mountSheet();
    const btn = wrapper.find('[data-testid="bulk-paste-submit"]');
    expect((btn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('emits submit with the inferred-category rows on Add click', async () => {
    const infer = vi.fn((name: string): Category => {
      if (name.toLowerCase().includes('latte')) return 'dairy';
      if (name.toLowerCase().includes('pane')) return 'bakery';
      return 'other';
    });
    const wrapper = mountSheet({ inferCategory: infer });
    await wrapper.find('[data-testid="bulk-paste-textarea"]').setValue('latte\npane\nbiscotti');
    await wrapper.find('[data-testid="bulk-paste-submit"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('submit')).toBeTruthy();
    const payload = wrapper.emitted('submit')![0]![0] as Array<{ name: string; category: Category }>;
    expect(payload).toEqual([
      { name: 'latte', category: 'dairy' },
      { name: 'pane', category: 'bakery' },
      { name: 'biscotti', category: 'other' },
    ]);
  });

  it('emits cancel on the bottom Cancel button', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="bulk-paste-cancel-bottom"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel on the backdrop click', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="bulk-paste-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
