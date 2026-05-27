import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ItemCountWithUrgent from '@/components/list/ItemCountWithUrgent.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: {
    it: {
      list: {
        urgentInlineOne: '1 urgente',
        urgentInlineMany: '{u} urgenti',
        urgentInlineWordOne: 'urgente',
        urgentInlineWordMany: 'urgenti',
      },
      listSettings: { stats: { items: 'Articoli' } },
    },
  },
});

const mountLabel = (props: Record<string, unknown>) =>
  mount(ItemCountWithUrgent, { props, global: { plugins: [i18n] } });

describe('ItemCountWithUrgent', () => {
  it('shows Articoli prefix with bold counts and dash separator for urgent', () => {
    const wrapper = mountLabel({ count: 4, urgentCount: 2 });
    expect(wrapper.text()).toContain('Articoli:');
    expect(wrapper.text()).toContain('4');
    expect(wrapper.text()).toContain('2 urgenti');
    expect(wrapper.text()).not.toContain('(');
    expect(wrapper.text()).toContain(' - ');
    const bold = wrapper.findAll('.font-semibold');
    expect(bold).toHaveLength(2);
    expect(bold[0]!.text()).toBe('4');
    expect(bold[1]!.text()).toBe('2');
  });

  it('shows flame icon beside urgent count', () => {
    const wrapper = mountLabel({ count: 4, urgentCount: 2 });
    expect(wrapper.find('[data-testid="urgent-inline"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="urgent-inline"] svg').exists()).toBe(true);
  });

  it('hides urgent segment when urgentCount is 0', () => {
    const wrapper = mountLabel({ count: 3, urgentCount: 0 });
    expect(wrapper.find('[data-testid="urgent-inline"]').exists()).toBe(false);
    expect(wrapper.text()).toBe('Articoli: 3');
  });

  it('uses singular urgent copy for one urgent item', () => {
    const wrapper = mountLabel({ count: 2, urgentCount: 1 });
    expect(wrapper.text()).toContain('1 urgente');
    expect(wrapper.text()).not.toContain('urgenti');
  });

  it('applies muted styling when muted is true', () => {
    const wrapper = mountLabel({ count: 2, urgentCount: 1, muted: true });
    expect(wrapper.find('[data-testid="item-count"]').classes()).toContain('text-white');
  });
});
