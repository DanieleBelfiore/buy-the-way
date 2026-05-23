import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

vi.mock('@/stores/catalog', () => ({
  useCatalogStore: vi.fn(),
}));

import ItemAutocomplete from '@/components/list/ItemAutocomplete.vue';
import { useCatalogStore, type Suggestion } from '@/stores/catalog';
import type { Category } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        addPlaceholder: 'Add an item',
        addCustom: 'Add "{name}" as a custom item',
      },
    },
  },
});

const makeEntry = (name: string, category: Category = 'dairy'): Suggestion => ({
  key: `u:${name}`,
  name,
  category,
  source: 'user',
  usageCount: 1,
});

const mockSuggestionsFor = vi.fn();

const mountComponent = (props: Record<string, unknown> = {}) =>
  mount(ItemAutocomplete, {
    props,
    global: {
      plugins: [i18n],
    },
  });

describe('ItemAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useCatalogStore).mockReturnValue({
      entries: [],
      suggestFor: vi.fn().mockReturnValue([]),
      suggestionsFor: mockSuggestionsFor,
      subscribe: vi.fn(),
      rankedEntries: [],
    } as any);
    mockSuggestionsFor.mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders input with correct placeholder', () => {
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toBe('Add an item');
  });

  it('shows suggestions when input matches catalog entries', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();
    expect(wrapper.text()).toContain('Latte');
  });

  it('shows custom item option when input has text', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('Tofu');
    await input.trigger('input');
    await flushPromises();
    expect(wrapper.text()).toContain('Tofu');
  });

  it('emits add-item when suggestion is clicked', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    const option = wrapper.find('[data-testid="suggestion-option"]');
    await option.trigger('click');
    expect(wrapper.emitted('add-item')).toBeTruthy();
    expect(wrapper.emitted('add-item')![0][0]).toMatchObject({ name: 'Latte', category: 'dairy' });
  });

  it('emits add-item with custom name when custom option clicked', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('Tofu');
    await input.trigger('input');
    await flushPromises();

    const custom = wrapper.find('[data-testid="custom-option"]');
    await custom.trigger('click');
    expect(wrapper.emitted('add-item')![0][0]).toMatchObject({ name: 'Tofu', category: 'other' });
  });

  it('clears input after adding item', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    await wrapper.find('[data-testid="suggestion-option"]').trigger('click');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('ArrowDown moves highlight to first option', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte'), makeEntry('Latte Scremato')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'ArrowDown' });
    const options = wrapper.findAll('[data-testid="suggestion-option"]');
    expect(options[0].classes()).toContain('bg-offwhite');
  });

  it('Enter commits highlighted option', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('add-item')![0][0]).toMatchObject({ name: 'Latte' });
  });

  it('Escape closes dropdown', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[data-testid="suggestion-option"]').exists()).toBe(false);
  });

  it('has role=combobox on input', () => {
    const wrapper = mountComponent();
    expect(wrapper.find('input').attributes('role')).toBe('combobox');
  });

  it('ArrowUp wraps from first to last option', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte'), makeEntry('Pane', 'bakery')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('l');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
  });

  it('ArrowDown when no options does not crash', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    // Empty query → no options, no custom
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
  });

  it('Enter without ArrowDown commits custom item directly', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('Tofu');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('add-item')![0][0]).toMatchObject({ name: 'Tofu', category: 'other' });
  });

  it('emits active-change(true) when input has text and active-change(false) when cleared', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('Tofu');
    await input.trigger('input');
    await flushPromises();
    const events = wrapper.emitted('active-change');
    expect(events).toBeTruthy();
    expect(events![events!.length - 1]).toEqual([true]);

    await input.setValue('');
    await input.trigger('input');
    await flushPromises();
    const events2 = wrapper.emitted('active-change')!;
    expect(events2[events2.length - 1]).toEqual([false]);
  });

  it('still shows all suggestions even when an item by that name is already in the list', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte'), makeEntry('Latte Scremato')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    const options = wrapper.findAll('[data-testid="suggestion-option"]');
    expect(options).toHaveLength(2);
  });

  it('Enter commits even when the typed name already exists in the list (duplicates allowed)', async () => {
    mockSuggestionsFor.mockReturnValue([]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('Latte');
    await input.trigger('input');
    await flushPromises();

    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('add-item')).toBeTruthy();
    expect(wrapper.emitted('add-item')![0][0]).toMatchObject({ name: 'Latte' });
  });

  it('has role=listbox on dropdown', async () => {
    mockSuggestionsFor.mockReturnValue([makeEntry('Latte')]);
    const wrapper = mountComponent();
    const input = wrapper.find('input');
    await input.setValue('lat');
    await input.trigger('input');
    await flushPromises();

    expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
  });
});
