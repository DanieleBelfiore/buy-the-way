import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';
import CategoryIcon from '@/components/ui/CategoryIcon.vue';
import CategoryHeader from '@/components/list/CategoryHeader.vue';
import ListItemRow from '@/components/list/ListItemRow.vue';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
});

describe('CategoryIcon', () => {
  test('renders for each category without error', () => {
    const categories = [
      'fruit_vegetables',
      'dairy',
      'meat_fish',
      'bakery',
      'beverages',
      'frozen',
      'cleaning',
      'hygiene',
      'other',
    ] as const;
    for (const cat of categories) {
      expect(() => mount(CategoryIcon, { props: { category: cat } })).not.toThrow();
    }
  });
});

describe('CategoryHeader', () => {
  test('shows checked/total count', () => {
    const w = mount(CategoryHeader, {
      props: { category: 'dairy', checked: 2, total: 5 },
      global: { plugins: [i18n] },
    });
    expect(w.text()).toContain('2/5');
  });

  test('has sec-h class', () => {
    const w = mount(CategoryHeader, {
      props: { category: 'bakery', checked: 0, total: 3 },
      global: { plugins: [i18n] },
    });
    expect(w.find('.sec-h').exists()).toBe(true);
  });
});

describe('ListItemRow', () => {
  test('renders item name', () => {
    const w = mount(ListItemRow, {
      props: { name: 'Milk', checked: false, category: 'dairy' },
    });
    expect(w.text()).toContain('Milk');
  });

  test('sets data-checked=true when checked', () => {
    const w = mount(ListItemRow, {
      props: { name: 'Eggs', checked: true, category: 'dairy' },
    });
    expect(w.attributes('data-checked')).toBe('true');
  });

  test('emits toggle on click', async () => {
    const w = mount(ListItemRow, {
      props: { name: 'Bread', checked: false, category: 'bakery' },
    });
    await w.trigger('click');
    expect(w.emitted('toggle')).toBeTruthy();
  });
});
