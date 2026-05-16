import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import CategoryIcon from '@/components/list/CategoryIcon.vue';
import CategoryHeader from '@/components/list/CategoryHeader.vue';
import CategorySection from '@/components/list/CategorySection.vue';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      category: {
        fruit_vegetables: 'Fruit & Veg',
        dairy: 'Dairy',
        meat_fish: 'Meat & Fish',
        bakery: 'Bakery',
        beverages: 'Beverages',
        frozen: 'Frozen',
        cleaning: 'Cleaning',
        hygiene: 'Hygiene',
        other: 'Other',
      },
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
  quantity: '1',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-1',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe('CategoryIcon', () => {
  it('renders an svg', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('applies color style from category cssVar', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    const style = wrapper.find('svg').attributes('style');
    expect(style).toContain('--cat-dairy');
  });

  it('has aria-hidden', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true');
  });
});

describe('CategoryHeader', () => {
  const mount_ = (category: Item['category']) =>
    mount(CategoryHeader, { props: { category }, global: { plugins: [i18n] } });

  it('renders category label text', () => {
    const wrapper = mount_('dairy');
    expect(wrapper.text()).toContain('Dairy');
  });

  it('renders category icon', () => {
    const wrapper = mount_('dairy');
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('renders correct label for other categories', () => {
    expect(mount_('bakery').text()).toContain('Bakery');
    expect(mount_('other').text()).toContain('Other');
  });
});

describe('CategorySection', () => {
  const mount_ = (items: Item[]) =>
    mount(CategorySection, {
      props: { category: 'dairy', items },
      global: { plugins: [i18n] },
    });

  it('renders category header', () => {
    const wrapper = mount_([makeItem()]);
    expect(wrapper.text()).toContain('Dairy');
  });

  it('renders one row per item', () => {
    const items = [
      makeItem({ id: '01A' as ULID, name: 'Latte' }),
      makeItem({ id: '01B' as ULID, name: 'Burro' }),
    ];
    const wrapper = mount_(items);
    expect(wrapper.text()).toContain('Latte');
    expect(wrapper.text()).toContain('Burro');
  });

  it('emits toggle-checked with item id and new value', async () => {
    const item = makeItem({ checked: false });
    const wrapper = mount_([item]);
    await wrapper.get('[data-testid="row-toggle"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([item.id, true]);
  });

  it('emits remove-item with item id when row remove fires', async () => {
    const item = makeItem();
    const wrapper = mount_([item]);
    await wrapper.get('[data-testid="row-remove"]').trigger('click');
    expect(wrapper.emitted('remove-item')?.[0]).toEqual([item.id]);
  });
});
