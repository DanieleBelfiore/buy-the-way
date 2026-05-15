import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import FAB from '@/components/ui/FAB.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { list: { new: 'New list' } } },
});

describe('FAB', () => {
  it('has aria-label from i18n', () => {
    const wrapper = mount(FAB, { global: { plugins: [i18n] } });
    expect(wrapper.attributes('aria-label')).toBe('New list');
  });

  it('emits click on button click', async () => {
    const wrapper = mount(FAB, { global: { plugins: [i18n] } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });

  it('renders a plus icon svg', () => {
    const wrapper = mount(FAB, { global: { plugins: [i18n] } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});
