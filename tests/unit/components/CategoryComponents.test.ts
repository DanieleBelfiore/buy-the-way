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
        allBought: 'All items in this category are bought',
        fruit_vegetables: 'Fruit & Veg',
        dairy: 'Dairy',
        meat: 'Meat',
        fish: 'Fish',
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
  it('renders an emoji', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    expect(wrapper.text()).toBe('🧀');
  });

  it('applies color style from category cssVar', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    expect(wrapper.html()).toContain('--cat-dairy');
  });

  it('renders with aria-hidden', () => {
    const wrapper = mount(CategoryIcon, { props: { category: 'dairy' } });
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });
});

describe('CategoryHeader', () => {
  const mount_ = (category: Item['category'], extra: Record<string, unknown> = {}) =>
    mount(CategoryHeader, {
      props: { category, ...extra },
      global: { plugins: [i18n] },
    });

  it('renders category label text', () => {
    const wrapper = mount_('dairy');
    expect(wrapper.text()).toContain('Dairy');
  });

  it('renders category icon', () => {
    const wrapper = mount_('dairy');
    expect(wrapper.text()).toContain('🧀');
  });

  it('renders correct label for other categories', () => {
    expect(mount_('bakery').text()).toContain('Bakery');
    expect(mount_('other').text()).toContain('Other');
  });

  it('renders bought/total counter when total > 0', () => {
    const wrapper = mount_('dairy', { bought: 2, total: 5 });
    expect(wrapper.get('[data-testid="category-counter"]').text()).toBe('2/5');
  });

  it('hides counter when total is 0', () => {
    const wrapper = mount_('dairy', { bought: 0, total: 0 });
    expect(wrapper.find('[data-testid="category-counter"]').exists()).toBe(false);
  });

  it('shows a check after the counter when every item is bought', () => {
    const wrapper = mount_('dairy', { bought: 3, total: 3 });
    expect(wrapper.find('[data-testid="category-all-bought"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="info-hint-tooltip"]').exists()).toBe(false);
  });

  it('hides the check when some items are still to buy', () => {
    const wrapper = mount_('dairy', { bought: 2, total: 5 });
    expect(wrapper.find('[data-testid="category-all-bought"]').exists()).toBe(false);
  });

  it('renders as button with chevron when interactive', () => {
    const wrapper = mount_('dairy', { interactive: true, total: 3, bought: 1 });
    expect(wrapper.element.tagName).toBe('BUTTON');
    expect(wrapper.find('[data-testid="category-chevron"]').exists()).toBe(true);
  });

  it('emits toggle on click when interactive', async () => {
    const wrapper = mount_('dairy', { interactive: true });
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle')).toBeTruthy();
  });

  it('does not emit toggle when not interactive', async () => {
    const wrapper = mount_('dairy');
    await wrapper.trigger('click');
    expect(wrapper.emitted('toggle')).toBeFalsy();
  });

  it('reflects collapsed state via aria-expanded', () => {
    const collapsed = mount_('dairy', { interactive: true, collapsed: true });
    expect(collapsed.attributes('aria-expanded')).toBe('false');
    const open = mount_('dairy', { interactive: true, collapsed: false });
    expect(open.attributes('aria-expanded')).toBe('true');
  });
});

describe('CategorySection', () => {
  const mount_ = (items: Item[], extra: Record<string, unknown> = {}) =>
    mount(CategorySection, {
      props: { category: 'dairy', items, ...extra },
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

  it('shows bought/total counter from items', () => {
    const items = [
      makeItem({ id: '01A' as ULID, checked: true }),
      makeItem({ id: '01B' as ULID, checked: false }),
      makeItem({ id: '01C' as ULID, checked: false }),
    ];
    const wrapper = mount_(items);
    expect(wrapper.get('[data-testid="category-counter"]').text()).toBe('1/3');
  });

  it('hides items when collapsed', () => {
    const items = [makeItem({ id: '01A' as ULID, name: 'Latte' })];
    const wrapper = mount_(items, { collapsed: true });
    expect(wrapper.text()).not.toContain('Latte');
    expect(wrapper.text()).toContain('Dairy');
    expect(wrapper.get('[data-testid="category-counter"]').exists()).toBe(true);
  });

  it('emits toggle-collapse with category on header click', async () => {
    const items = [makeItem()];
    const wrapper = mount_(items);
    await wrapper.get('[data-testid="category-header"]').trigger('click');
    expect(wrapper.emitted('toggle-collapse')?.[0]).toEqual(['dairy']);
  });
});
