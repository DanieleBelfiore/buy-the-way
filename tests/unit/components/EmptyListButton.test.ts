import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import EmptyListButton from '@/components/list/EmptyListButton.vue';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: {
    it: {
      emptyList: {
        button: 'Rimuovi tutti gli articoli',
        confirmTitle: 'Svuotare la lista?',
        confirmMessage: 'Cosa vuoi rimuovere dalla lista?',
        confirmAll: 'Tutti',
        confirmBought: 'Solo comprati',
      },
      list: {
        completionEmptyTitle: 'Tutto comprato!',
        completionEmptyMessage: 'Hai spuntato tutti gli articoli. Vuoi svuotare la lista adesso?',
        completionEmptyConfirm: 'Svuota lista',
        completionEmptyCancel: 'Mantieni lista',
      },
    },
  },
});

const mountBtn = (count: number, boughtCount = 0) =>
  mount(EmptyListButton, {
    props: { count, boughtCount },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('EmptyListButton', () => {
  it('renders nothing when count is 0', () => {
    const wrapper = mountBtn(0);
    expect(wrapper.find('[data-testid="empty-list-button"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders an icon-only button when count > 0', () => {
    const wrapper = mountBtn(3);
    const btn = wrapper.find('[data-testid="empty-list-button"]');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe('');
    expect(btn.classes()).not.toContain('bg-red-700');
  });

  it('opens choice modal on click when not all bought', async () => {
    const wrapper = mountBtn(3, 1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Tutti');
    expect(wrapper.text()).toContain('Solo comprati');
    wrapper.unmount();
  });

  it('shows completion confirm when all items are bought', async () => {
    const wrapper = mountBtn(3, 3);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    expect(wrapper.text()).toContain('Tutto comprato!');
    expect(wrapper.text()).toContain('Mantieni lista');
    expect(wrapper.text()).toContain('Svuota lista');
    expect(wrapper.emitted('empty')).toBeFalsy();
    wrapper.unmount();
  });

  it('empties on completion confirm when all items are bought', async () => {
    const wrapper = mountBtn(3, 3);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click');
    expect(wrapper.emitted('empty')).toEqual([['all']]);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps list on completion cancel when all items are bought', async () => {
    const wrapper = mountBtn(3, 3);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click');
    expect(wrapper.emitted('empty')).toBeFalsy();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('closes modal and does not emit empty when backdrop pressed', async () => {
    const wrapper = mountBtn(3, 1);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="dual-choice-modal-backdrop"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.emitted('empty')).toBeFalsy();
    wrapper.unmount();
  });

  it('emits empty with all scope when left button pressed', async () => {
    const wrapper = mountBtn(3, 1);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="dual-choice-modal-left"]').trigger('click');
    expect(wrapper.emitted('empty')).toEqual([['all']]);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('emits empty with checked scope when right button pressed', async () => {
    const wrapper = mountBtn(3, 2);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    await wrapper.get('[data-testid="dual-choice-modal-right"]').trigger('click');
    expect(wrapper.emitted('empty')).toEqual([['checked']]);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('disables bought-only when no checked items', async () => {
    const wrapper = mountBtn(3, 0);
    await wrapper.get('[data-testid="empty-list-button"]').trigger('click');
    expect(wrapper.get('[data-testid="dual-choice-modal-right"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('has aria-label on the button', () => {
    const wrapper = mountBtn(3);
    const btn = wrapper.get('[data-testid="empty-list-button"]');
    expect(btn.attributes('aria-label')).toBe('Rimuovi tutti gli articoli');
  });
});
