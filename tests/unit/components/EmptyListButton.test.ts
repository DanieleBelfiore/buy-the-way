import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import EmptyListButton from '@/components/list/EmptyListButton.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      emptyList: {
        button: 'Empty list',
        confirmTitle: 'Empty list?',
        confirmMessage: 'This will remove all {count} items. This cannot be undone.',
        confirm: 'Empty',
        cancel: 'Cancel',
      },
    },
  },
});

const mountBtn = (count: number) =>
  mount(EmptyListButton, {
    props: { count },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('EmptyListButton', () => {
  it('renders nothing when count is 0', () => {
    const wrapper = mountBtn(0);
    expect(wrapper.find('[data-testid="empty-list-button"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders pill button when count > 0', () => {
    const wrapper = mountBtn(3);
    const btn = wrapper.find('[data-testid="empty-list-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Empty list');
  });

  it('does not render a count badge', () => {
    const wrapper = mountBtn(7);
    const btn = wrapper.find('[data-testid="empty-list-button"]');
    expect(btn.text()).not.toContain('7');
  });

  it('opens confirm modal on click', async () => {
    const wrapper = mountBtn(3);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('interpolates count into confirm message', async () => {
    const wrapper = mountBtn(12);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    expect(wrapper.text()).toContain('12');
    wrapper.unmount();
  });

  it('closes modal and does not emit empty when cancel pressed', async () => {
    const wrapper = mountBtn(3);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.emitted('empty')).toBeFalsy();
    wrapper.unmount();
  });

  it('emits empty and closes modal when confirm pressed', async () => {
    const wrapper = mountBtn(3);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click');
    expect(wrapper.emitted('empty')).toBeTruthy();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('has aria-label on the pill button', () => {
    const wrapper = mountBtn(3);
    const btn = wrapper.get('[data-testid="empty-list-button"]');
    expect(btn.attributes('aria-label')).toBe('Empty list');
  });
});
