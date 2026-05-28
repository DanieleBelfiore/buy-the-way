import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import NotificationsPopover from '@/components/notifications/NotificationsPopover.vue';
import type { NotificationDoc } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      notifications: {
        title: 'Notifications',
        close: 'Close',
        empty: 'No notifications.',
        badgeAria: 'Unread',
        body: {
          itemModifiedWith: '{sender} updated {item}.',
          itemModifiedWithout: '{sender} updated an item.',
          invitedToList: '{sender} invited you to their list {list}.',
        },
      },
    },
    it: {
      notifications: {
        title: 'Notifiche',
        close: 'Chiudi',
        empty: 'Nessuna notifica.',
        badgeAria: 'Non lette',
        body: {
          itemModifiedWith: '{sender} ha aggiornato {item}.',
          itemModifiedWithout: '{sender} ha aggiornato un articolo.',
          invitedToList: '{sender} ti ha invitato a partecipare alla sua lista {list}.',
        },
      },
    },
  },
});

const sampleItems: NotificationDoc[] = [
  {
    id: 'n1',
    kind: 'item-modified',
    listId: 'L1',
    listName: 'Spesa',
    senderUid: 'u2',
    senderName: 'Bob',
    locale: 'it',
    itemId: 'I1',
    itemName: 'pane',
    createdAt: 1700000000000,
  },
  {
    id: 'n2',
    kind: 'collaborator-added',
    listId: 'L1',
    listName: 'Spesa',
    senderUid: 'u2',
    senderName: 'Bob',
    locale: 'en',
    itemName: 'Carol',
    createdAt: 1700000010000,
  },
];

const mountPopover = (props: Partial<InstanceType<typeof NotificationsPopover>['$props']> = {}) =>
  mount(NotificationsPopover, {
    props: {
      open: true,
      items: sampleItems,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('NotificationsPopover', () => {
  it('renders nothing when open is false', () => {
    const wrapper = mountPopover({ open: false });
    expect(wrapper.find('[data-testid="notifications-popover"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders dialog with title when open', () => {
    const wrapper = mountPopover();
    expect(wrapper.get('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Notifications');
    wrapper.unmount();
  });

  it('renders one row per notification', () => {
    const wrapper = mountPopover();
    expect(wrapper.findAll('[data-testid="notification-row"]')).toHaveLength(2);
    wrapper.unmount();
  });

  it('renders empty state when items is empty', () => {
    const wrapper = mountPopover({ items: [] });
    expect(wrapper.find('[data-testid="notifications-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="notifications-list"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No notifications.');
    wrapper.unmount();
  });

  it('emits open-list with the row listId on row click', async () => {
    const wrapper = mountPopover();
    const rows = wrapper.findAll('[data-testid="notification-row"] button');
    await rows[0]!.trigger('click');
    expect(wrapper.emitted('open-list')).toEqual([['L1']]);
    wrapper.unmount();
  });

  it('emits close on backdrop click', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[data-testid="notifications-backdrop"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits close on close button click', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[data-testid="notifications-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });

  it('emits close on Escape key', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });

  it('renders the body in the sender locale with bold slots', () => {
    const wrapper = mountPopover();
    // First row: item-modified IT - sender + item bold.
    expect(wrapper.text()).toContain('Bob ha aggiornato pane.');
    // Second row: collaborator-added EN - sender + list bold ("you've been invited").
    expect(wrapper.text()).toContain('Bob invited you to their list Spesa.');
    const strongs = wrapper.findAll('strong');
    const texts = strongs.map((s) => s.text());
    expect(texts).toContain('Bob');
    expect(texts).toContain('pane');
    expect(texts).toContain('Spesa');
    wrapper.unmount();
  });

  it('allows notification title and body to wrap (no truncate or nowrap)', () => {
    const wrapper = mountPopover();
    const row = wrapper.get('[data-testid="notification-row"]');
    const title = row.find('span.block.text-sm.font-medium');
    const body = row.find('span.block.text-sm.text-muted-gray');
    for (const span of [title, body]) {
      const cls = span.classes().join(' ');
      expect(cls).not.toMatch(/truncate|whitespace-nowrap/);
      expect(cls).toContain('break-words');
    }
    const i18nBody = body.find('[class*="overflow-wrap"]');
    expect(i18nBody.exists()).toBe(true);
    wrapper.unmount();
  });

  it('sets aria-modal and aria-labelledby on the dialog', () => {
    const wrapper = mountPopover();
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBeTruthy();
    wrapper.unmount();
  });
});
