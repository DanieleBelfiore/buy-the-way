import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import PriorityPickerSheet from '@/components/list/PriorityPickerSheet.vue';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        priority: 'Priority',
        priorityUrgent: 'Urgent',
        priorityOptional: 'Optional',
        priorityNone: 'Normal',
      },
      list: { cancel: 'Cancel' },
    },
  },
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '01A' as ULID,
  listId: '01L' as ULID,
  name: 'Latte',
  quantity: '',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'u',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

const mountSheet = (props: { open: boolean; item?: Item | null }) =>
  mount(PriorityPickerSheet, {
    props: {
      open: props.open,
      item: props.item ?? makeItem(),
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('PriorityPickerSheet', () => {
  it('does not render when closed', () => {
    const wrapper = mountSheet({ open: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders all three priority options when open', () => {
    const wrapper = mountSheet({ open: true });
    expect(wrapper.find('[data-testid="priority-picker-urgent"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="priority-picker-none"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="priority-picker-optional"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('marks the current priority chip as checked', () => {
    const wrapper = mountSheet({ open: true, item: makeItem({ priority: 'urgent' }) });
    expect(wrapper.get('[data-testid="priority-picker-urgent"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-testid="priority-picker-none"]').attributes('aria-checked')).toBe('false');
    wrapper.unmount();
  });

  it('marks "none" as checked when item has no priority', () => {
    const wrapper = mountSheet({ open: true });
    expect(wrapper.get('[data-testid="priority-picker-none"]').attributes('aria-checked')).toBe('true');
    wrapper.unmount();
  });

  it('emits select "urgent" when urgent clicked', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="priority-picker-urgent"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['urgent']);
    wrapper.unmount();
  });

  it('emits select "optional" when optional clicked', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="priority-picker-optional"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['optional']);
    wrapper.unmount();
  });

  it('emits select null when none clicked', async () => {
    const wrapper = mountSheet({ open: true, item: makeItem({ priority: 'urgent' }) });
    await wrapper.get('[data-testid="priority-picker-none"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual([null]);
    wrapper.unmount();
  });

  it('emits cancel on backdrop click', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="priority-picker-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on cancel button click', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="priority-picker-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });
});
