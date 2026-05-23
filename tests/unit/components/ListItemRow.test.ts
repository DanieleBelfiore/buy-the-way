import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ListItemRow from '@/components/list/ListItemRow.vue';
import type { Item } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      item: {
        markAsBought: 'Mark as bought',
        markAsToBuy: 'Mark as to buy',
        remove: 'Remove item',
        priorityUrgent: 'Urgent',
        priorityOptional: 'Optional',
        priorityNone: 'Normal',
        openSettings: 'Edit item',
        moveOrCopy: 'Move or copy',
        pinFavorite: 'Pin to favorites',
        unpinFavorite: 'Unpin from favorites',
        customBadge: 'Custom item',
      },
    },
  },
});

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '01ABCDEFGH01234567890ABC12' as ULID,
  listId: '01ABCDEFGH01234567890ABC00' as ULID,
  name: 'Latte',
  quantity: '2',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-1',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const mountRow = (item: Item) =>
  mount(ListItemRow, { props: { item }, global: { plugins: [i18n] } });

describe('ListItemRow', () => {
  it('renders item name', () => {
    const wrapper = mountRow(makeItem());
    expect(wrapper.text()).toContain('Latte');
  });

  it('does NOT render custom badge for public-catalog item (Latte)', () => {
    const wrapper = mountRow(makeItem({ name: 'Latte' }));
    expect(wrapper.find('[data-testid="row-custom-badge"]').exists()).toBe(false);
  });

  it('renders custom badge for custom item name', () => {
    const wrapper = mountRow(makeItem({ name: 'Babà' }));
    expect(wrapper.find('[data-testid="row-custom-badge"]').exists()).toBe(true);
  });

  it('renders the inline quantity indicator on the row', () => {
    const wrapper = mountRow(makeItem({ quantity: '2L' }));
    expect(wrapper.find('[data-testid="row-quantity"]').exists()).toBe(true);
    const visibleText = wrapper.find('[data-testid="row-quantity"]').text();
    expect(visibleText).toContain('2L');
  });

  it('emits toggle-checked with negated bool on toggle click (unchecked → true)', async () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    await wrapper.get('[data-testid="row-toggle"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([true]);
  });

  it('emits toggle-checked with negated bool on toggle click (checked → false)', async () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    await wrapper.get('[data-testid="row-toggle"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')?.[0]).toEqual([false]);
  });

  it('toggle button has aria-label "Mark as bought" when unchecked', () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    const btn = wrapper.get('[data-testid="row-toggle"]');
    expect(btn.attributes('aria-label')).toBe('Mark as bought');
  });

  it('toggle button has aria-label "Mark as to buy" when checked', () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    const btn = wrapper.get('[data-testid="row-toggle"]');
    expect(btn.attributes('aria-label')).toBe('Mark as to buy');
  });

  it('renders a trash button with aria-label "Remove item"', () => {
    const wrapper = mountRow(makeItem());
    const trash = wrapper.get('[data-testid="row-remove"]');
    expect(trash.attributes('aria-label')).toBe('Remove item');
  });

  it('emits remove on trash button click', async () => {
    const wrapper = mountRow(makeItem());
    await wrapper.get('[data-testid="row-remove"]').trigger('click');
    expect(wrapper.emitted('remove')).toBeTruthy();
  });

  it('clicking trash does not emit toggle-checked', async () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    await wrapper.get('[data-testid="row-remove"]').trigger('click');
    expect(wrapper.emitted('toggle-checked')).toBeFalsy();
  });

  it('applies strikethrough class when checked', () => {
    const wrapper = mountRow(makeItem({ checked: true }));
    expect(wrapper.html()).toContain('line-through');
  });

  it('does not apply strikethrough when unchecked', () => {
    const wrapper = mountRow(makeItem({ checked: false }));
    expect(wrapper.html()).not.toContain('line-through');
  });

  describe('long-press removed', () => {
    // Long-press to open the edit sheet was dropped because the per-row
    // Settings icon already covers the same intent visibly. Hold should be
    // a plain click — no extra emit.
    it('does not emit open-edit on a hold', async () => {
      vi.useFakeTimers();
      const wrapper = mountRow(makeItem());
      const toggle = wrapper.get('[data-testid="row-toggle"]');
      await toggle.trigger('pointerdown', { pointerType: 'touch' });
      vi.advanceTimersByTime(1000);
      expect(wrapper.emitted('open-edit')).toBeFalsy();
      vi.useRealTimers();
    });
  });

  describe('priority button', () => {
    it('renders priority button next to trash', () => {
      const wrapper = mountRow(makeItem());
      expect(wrapper.find('[data-testid="row-priority"]').exists()).toBe(true);
    });

    it('priority button aria-label is "Normal" when no priority', () => {
      const wrapper = mountRow(makeItem());
      expect(wrapper.get('[data-testid="row-priority"]').attributes('aria-label')).toBe('Normal');
    });

    it('priority button aria-label is "Urgent" when priority=urgent', () => {
      const wrapper = mountRow(makeItem({ priority: 'urgent' }));
      expect(wrapper.get('[data-testid="row-priority"]').attributes('aria-label')).toBe('Urgent');
    });

    it('priority button aria-label is "Optional" when priority=optional', () => {
      const wrapper = mountRow(makeItem({ priority: 'optional' }));
      expect(wrapper.get('[data-testid="row-priority"]').attributes('aria-label')).toBe('Optional');
    });

    it('emits request-priority with the item when clicked', async () => {
      const item = makeItem();
      const wrapper = mountRow(item);
      await wrapper.get('[data-testid="row-priority"]').trigger('click');
      expect(wrapper.emitted('request-priority')?.[0]).toEqual([item]);
    });

    it('does not emit toggle-checked when priority button clicked', async () => {
      const wrapper = mountRow(makeItem());
      await wrapper.get('[data-testid="row-priority"]').trigger('click');
      expect(wrapper.emitted('toggle-checked')).toBeFalsy();
    });

    it('applies red styling when priority=urgent', () => {
      const wrapper = mountRow(makeItem({ priority: 'urgent' }));
      expect(wrapper.html()).toContain('text-red-700');
    });
  });

  describe('pinned star button', () => {
    it('renders an unfilled star by default', () => {
      const wrapper = mountRow(makeItem());
      const btn = wrapper.get('[data-testid="row-pinned"]');
      expect(btn.attributes('aria-pressed')).toBe('false');
      expect(btn.attributes('aria-label')).toBe('Pin to favorites');
    });

    it('renders filled gold star when pinned', () => {
      const wrapper = mount(ListItemRow, {
        props: { item: makeItem(), pinned: true },
        global: { plugins: [i18n] },
      });
      const btn = wrapper.get('[data-testid="row-pinned"]');
      expect(btn.attributes('aria-pressed')).toBe('true');
      expect(btn.attributes('aria-label')).toBe('Unpin from favorites');
      expect(btn.classes().join(' ')).toContain('text-favorite-gold');
    });

    it('emits toggle-pinned with the item when clicked', async () => {
      const item = makeItem();
      const wrapper = mountRow(item);
      await wrapper.get('[data-testid="row-pinned"]').trigger('click');
      expect(wrapper.emitted('toggle-pinned')?.[0]).toEqual([item]);
    });
  });

  describe('canMoveCopy gate', () => {
    it('hides move-copy button when canMoveCopy=false', () => {
      const wrapper = mount(ListItemRow, {
        props: { item: makeItem(), canMoveCopy: false },
        global: { plugins: [i18n] },
      });
      expect(wrapper.find('[data-testid="row-move-copy"]').exists()).toBe(false);
    });

    it('shows move-copy button when canMoveCopy=true (default)', () => {
      const wrapper = mountRow(makeItem());
      expect(wrapper.find('[data-testid="row-move-copy"]').exists()).toBe(true);
    });
  });

  describe('move-copy shortcut button', () => {
    it('renders the move-copy button with aria-label "Move or copy"', () => {
      const wrapper = mountRow(makeItem());
      const btn = wrapper.get('[data-testid="row-move-copy"]');
      expect(btn.attributes('aria-label')).toBe('Move or copy');
    });

    it('emits move-copy with the item when clicked', async () => {
      const item = makeItem();
      const wrapper = mountRow(item);
      await wrapper.get('[data-testid="row-move-copy"]').trigger('click');
      expect(wrapper.emitted('move-copy')?.[0]).toEqual([item]);
    });

    it('does not emit toggle-checked when move-copy button clicked', async () => {
      const wrapper = mountRow(makeItem());
      await wrapper.get('[data-testid="row-move-copy"]').trigger('click');
      expect(wrapper.emitted('toggle-checked')).toBeFalsy();
    });
  });

  describe('settings shortcut button', () => {
    it('renders the settings button with aria-label "Edit item"', () => {
      const wrapper = mountRow(makeItem());
      const btn = wrapper.get('[data-testid="row-settings"]');
      expect(btn.attributes('aria-label')).toBe('Edit item');
    });

    it('emits open-edit with the item when clicked', async () => {
      const item = makeItem();
      const wrapper = mountRow(item);
      await wrapper.get('[data-testid="row-settings"]').trigger('click');
      expect(wrapper.emitted('open-edit')?.[0]).toEqual([item]);
    });

    it('does not emit toggle-checked when settings button clicked', async () => {
      const wrapper = mountRow(makeItem());
      await wrapper.get('[data-testid="row-settings"]').trigger('click');
      expect(wrapper.emitted('toggle-checked')).toBeFalsy();
    });
  });
});
