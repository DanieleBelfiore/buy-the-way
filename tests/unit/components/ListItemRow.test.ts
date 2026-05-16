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
        remove: 'Remove item',
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

  it('emits toggle-checked with negated bool on toggle click (unchecked → true)', async () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    await wrapper.get('[data-testid="row-toggle"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([true]);
  });

  it('emits toggle-checked with negated bool on toggle click (checked → false)', async () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    await wrapper.get('[data-testid="row-toggle"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([false]);
  });

  it('toggle button has aria-label "Mark as bought" when unchecked', () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    const btn = wrapper.get('[data-testid="row-toggle"]');
    expect(btn.attributes('aria-label')).toBe('Mark as bought');
  });

  it('toggle button has aria-label "Mark as to buy" when checked', () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    const btn = wrapper.get('[data-testid="row-toggle"]');
    expect(btn.attributes('aria-label')).toBe('Mark as to buy');
  });

  it('renders a trash button with aria-label "Remove item"', () => {
    const wrapper = mountRow(makeItem());
    const trash = wrapper.get('[data-testid="row-remove"]');
    expect(trash.attributes('aria-label')).toBe('Remove item');
  });

  it('emits remove on trash button click', async () => {
    const wrapper = mountRow(makeItem());
    await wrapper.get('[data-testid="row-remove"]').trigger('click');
    expect(wrapper.emitted('remove')).toBeTruthy();
  });

  it('clicking trash does not emit toggle-checked', async () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    await wrapper.get('[data-testid="row-remove"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')).toBeFalsy();
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
