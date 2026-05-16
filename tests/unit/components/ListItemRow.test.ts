import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ListItemRow from '@/components/list/ListItemRow.vue';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        markAsBought: 'Mark as bought',
        markAsToBuy: 'Mark as to buy',
      },
    },
  },
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '01ABCDEFGH01234567890ABC12' as ULID,
  listId: '01ABCDEFGH01234567890ABC00' as ULID,
  name: 'Latte',
  quantity: '2',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-1',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const mountRow = (item: Item) =>
  mount(ListItemRow, { props: { item }, global: { plugins: [i18n] } });

describe('ListItemRow', () => {
  it('renders item name', () => {
    const wrapper = mountRow(makeItem());
    expect(wrapper.text()).toContain('Latte');
  });

  it('renders item quantity', () => {
    const wrapper = mountRow(makeItem());
    expect(wrapper.text()).toContain('2');
  });

  it('emits toggle-checked with negated bool on click (unchecked → true)', async () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([true]);
  });

  it('emits toggle-checked with negated bool on click (checked → false)', async () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([false]);
  });

  it('has aria-label "Mark as bought" when unchecked', () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    const btn = wrapper.find('button');
    expect(btn.attributes('aria-label')).toBe('Mark as bought');
  });

  it('has aria-label "Mark as to buy" when checked', () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    const btn = wrapper.find('button');
    expect(btn.attributes('aria-label')).toBe('Mark as to buy');
  });

  it('applies strikethrough class when checked', () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    expect(wrapper.html()).toContain('line-through');
  });

  it('does not apply strikethrough when unchecked', () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    expect(wrapper.html()).not.toContain('line-through');
  });
});
