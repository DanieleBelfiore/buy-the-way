import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ConfirmModal from '@/components/ui/ConfirmModal.vue';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } });

const mountModal = (props: Partial<InstanceType<typeof ConfirmModal>['$props']> = {}) =>
  mount(ConfirmModal, {
    props: {
      open: true,
      title: 'Empty list?',
      message: 'This will remove all 3 items.',
      confirmLabel: 'Empty',
      cancelLabel: 'Cancel',
      destructive: true,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('ConfirmModal', () => {
  it('renders nothing when open is false', () => {
    const wrapper = mountModal({ open: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders dialog role when open', () => {
    const wrapper = mountModal();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows title and message', () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain('Empty list?');
    expect(wrapper.text()).toContain('This will remove all 3 items.');
    wrapper.unmount();
  });

  it('shows confirm and cancel labels', () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain('Empty');
    expect(wrapper.text()).toContain('Cancel');
    wrapper.unmount();
  });

  it('emits confirm on confirm button click', async () => {
    const wrapper = mountModal();
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click');
    expect(wrapper.emitted('confirm')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on cancel button click', async () => {
    const wrapper = mountModal();
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on backdrop click', async () => {
    const wrapper = mountModal();
    await wrapper.get('[data-testid="confirm-modal-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on Escape key', async () => {
    const wrapper = mountModal();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('marks confirm button as destructive when destructive prop is true', () => {
    const wrapper = mountModal({ destructive: true });
    const btn = wrapper.get('[data-testid="confirm-modal-confirm"]');
    expect(btn.classes().join(' ')).toMatch(/red|destructive/i);
    wrapper.unmount();
  });

  it('sets aria-modal and aria-labelledby on dialog', () => {
    const wrapper = mountModal();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBeTruthy();
  });
});
