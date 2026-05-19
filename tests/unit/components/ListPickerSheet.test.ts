import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ListPickerSheet from '@/components/list/ListPickerSheet.vue';
import type { List } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        moveOrCopy: 'Move or copy',
        copy: 'Copy',
        move: 'Move',
        noOtherLists: 'No other lists available',
      },
      list: { cancel: 'Cancel' },
    },
  },
});

const makeList = (id: string, name: string): List => ({
  id: id as ULID,
  name,
  ownerUid: 'u1',
  collaboratorUids: ['u1'],
  createdAt: 1,
  updatedAt: 1,
});

const mountSheet = (props: {
  open: boolean;
  item?: { name: string } | null;
  lists?: List[];
  busy?: boolean;
}) =>
  mount(ListPickerSheet, {
    props: {
      open: props.open,
      item: props.item ?? { name: 'Latte' },
      lists: props.lists ?? [],
      busy: props.busy ?? false,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('ListPickerSheet', () => {
  it('does not render when closed', () => {
    const wrapper = mountSheet({ open: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows empty state when lists is empty', () => {
    const wrapper = mountSheet({ open: true });
    expect(wrapper.find('[data-testid="list-picker-empty"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders one row per list with Copy and Move buttons', () => {
    const lists = [makeList('L1', 'Spesa'), makeList('L2', 'Cucina')];
    const wrapper = mountSheet({ open: true, lists });
    expect(wrapper.find('[data-testid="list-picker-row-L1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="list-picker-row-L2"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="list-picker-copy-L1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="list-picker-move-L1"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('emits copy with the chosen list id', async () => {
    const lists = [makeList('L1', 'Spesa')];
    const wrapper = mountSheet({ open: true, lists });
    await wrapper.get('[data-testid="list-picker-copy-L1"]').trigger('click');
    expect(wrapper.emitted('copy')?.[0]).toEqual(['L1']);
    wrapper.unmount();
  });

  it('emits move with the chosen list id', async () => {
    const lists = [makeList('L1', 'Spesa')];
    const wrapper = mountSheet({ open: true, lists });
    await wrapper.get('[data-testid="list-picker-move-L1"]').trigger('click');
    expect(wrapper.emitted('move')?.[0]).toEqual(['L1']);
    wrapper.unmount();
  });

  it('emits cancel on backdrop click', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="list-picker-backdrop"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits cancel on cancel button click', async () => {
    const wrapper = mountSheet({ open: true });
    await wrapper.get('[data-testid="list-picker-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
    wrapper.unmount();
  });

  it('disables copy/move buttons when busy', () => {
    const lists = [makeList('L1', 'Spesa')];
    const wrapper = mountSheet({ open: true, lists, busy: true });
    expect(wrapper.get('[data-testid="list-picker-copy-L1"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="list-picker-move-L1"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
