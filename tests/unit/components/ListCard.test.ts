import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import ListCard from '@/components/list/ListCard.vue';
import type { List } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      badge: { new: 'New' },
      list: {
        setDefault: 'Set as default list',
        unsetDefault: 'Unset default list',
        urgentInlineOne: '1 urgent',
        urgentInlineMany: '{u} urgent',
        urgentInlineWordOne: 'urgent',
        urgentInlineWordMany: 'urgent',
      },
      listSettings: { stats: { items: 'Items' } },
    },
  },
});

const mockList: List = {
  id: '01ABCDEFGH01234567890ABC12' as any,
  name: 'Spesa',
  ownerUid: 'uid-1',
  collaboratorUids: ['uid-1'],
  createdAt: 100,
  updatedAt: 200,
};

const mountCard = (props: { list: List; isDefault?: boolean }) =>
  mount(ListCard, { props, global: { plugins: [i18n, createPinia()] } });

describe('ListCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the list name', () => {
    const wrapper = mountCard({ list: mockList });
    expect(wrapper.text()).toContain('Spesa');
  });

  it('has aria-label matching list name', () => {
    const wrapper = mountCard({ list: mockList });
    expect(wrapper.attributes('aria-label')).toBe('Spesa');
  });

  it('emits open with list id on click', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([mockList.id]);
  });

  it('never renders the "new" badge (removed in S4.2)', () => {
    const wrapper = mountCard({ list: mockList });
    expect(wrapper.find('[data-testid="new-badge"]').exists()).toBe(false);
  });

  it('does not set inline background when no wallpaper present', () => {
    const wrapper = mountCard({ list: mockList });
    const card = wrapper.find('[data-testid="list-card"]');
    expect(card.attributes('style') ?? '').not.toContain('background-image');
  });

  it('applies wallpaper background image when wallpaper field is set', () => {
    const wrapper = mountCard({ list: { ...mockList, wallpaper: '05.jpg' } });
    const card = wrapper.find('[data-testid="list-card"]');
    const style = card.attributes('style') ?? '';
    expect(style).toContain('/wallpapers/05.jpg');
    expect(style).toContain('cover');
  });

  it('switches text color to white when wallpaper is present', () => {
    const wrapper = mountCard({ list: { ...mockList, wallpaper: '05.jpg' } });
    const title = wrapper.find('[data-testid="list-card"] .font-medium');
    expect(title.classes()).toContain('text-white');
    expect(title.classes()).toContain('wallpaper-overlay-text');
  });

  it('applies text shadow on wallpaper meta without a background pill', () => {
    const wrapper = mountCard({ list: { ...mockList, wallpaper: '05.jpg', itemCount: 3 } });
    const meta = wrapper.find('[data-testid="item-count"]').element.parentElement;
    expect(meta?.className).toContain('wallpaper-overlay-text');
    expect(meta?.className).not.toContain('bg-black');
  });

  it('renders a pin toggle button labelled "set as default" when not default', () => {
    const wrapper = mountCard({ list: mockList });
    const star = wrapper.find(`[data-testid="pin-${mockList.id}"]`);
    expect(star.exists()).toBe(true);
    expect(star.attributes('aria-pressed')).toBe('false');
    expect(star.attributes('aria-label')).toBe('Set as default list');
  });

  it('flips the pin button label to "unset" when isDefault is true', () => {
    const wrapper = mountCard({ list: mockList, isDefault: true });
    const pin = wrapper.find(`[data-testid="pin-${mockList.id}"]`);
    expect(pin.attributes('aria-pressed')).toBe('true');
    expect(pin.attributes('aria-label')).toBe('Unset default list');
    expect(pin.classes()).toContain('text-primary');
    expect(pin.classes()).not.toContain('bg-primary');
  });

  it('adds list-card-no-drag when isDefault is true', () => {
    const wrapper = mountCard({ list: mockList, isDefault: true });
    expect(wrapper.find('[data-testid="list-card"]').classes()).toContain('list-card-no-drag');
  });

  it('emits toggle-default with the list id when the pin is clicked', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.find(`[data-testid="pin-${mockList.id}"]`).trigger('click');
    expect(wrapper.emitted('toggle-default')?.[0]).toEqual([mockList.id]);
  });

  it('does not also emit open when the pin is clicked (stopPropagation)', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.find(`[data-testid="pin-${mockList.id}"]`).trigger('click');
    expect(wrapper.emitted('open')).toBeUndefined();
  });

  it('still emits open when the card body is clicked', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.find('[data-testid="list-card"]').trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([mockList.id]);
  });

  it('avatar chips carry both light and dark Tailwind palette classes', () => {
    const wrapper = mountCard({
      list: {
        ...mockList,
        collaboratorUids: ['uid-1', 'uid-2'],
      },
    });
    // Force render with stub members so we get rendered avatar nodes.
    const wrapperWithMembers = mount(ListCard, {
      props: {
        list: mockList,
        members: [
          { uid: 'uid-1', email: 'a@x', displayName: 'A', lastLoginAt: 0 },
        ],
      },
      global: { plugins: [i18n, createPinia()] },
    });
    const avatar = wrapperWithMembers.find('[data-testid="avatar-uid-1"]');
    expect(avatar.exists()).toBe(true);
    // Each chip must declare a light hue AND a dark hue so contrast holds in both themes.
    const cls = avatar.classes().join(' ');
    expect(/bg-(rose|amber|emerald|sky|violet|pink|lime|cyan)-200/.test(cls)).toBe(true);
    expect(/dark:bg-(rose|amber|emerald|sky|violet|pink|lime|cyan)-900/.test(cls)).toBe(true);
    expect(/text-(rose|amber|emerald|sky|violet|pink|lime|cyan)-900/.test(cls)).toBe(true);
    expect(/dark:text-(rose|amber|emerald|sky|violet|pink|lime|cyan)-100/.test(cls)).toBe(true);
    expect(wrapper).toBeTruthy();
  });

  it('includes urgent count with icon in item-count when urgentCount > 0', () => {
    const wrapper = mountCard({
      list: { ...mockList, itemCount: 4, urgentCount: 2, updatedAt: Date.UTC(2026, 0, 15, 10, 30) },
    });
    expect(wrapper.find('[data-testid="item-count"]').text()).toContain('Items:');
    expect(wrapper.find('[data-testid="item-count"]').text()).toContain('4');
    expect(wrapper.find('[data-testid="item-count"]').text()).toContain('2 urgent');
    expect(wrapper.find('[data-testid="urgent-inline"] svg').exists()).toBe(true);
  });

  it('omits urgent suffix when urgentCount is 0', () => {
    const wrapper = mountCard({ list: { ...mockList, itemCount: 2, urgentCount: 0 } });
    expect(wrapper.find('[data-testid="item-count"]').text()).toBe('Items: 2');
  });

  it('uses white pin styling on wallpaper cards when pinned', () => {
    const wrapper = mountCard({
      list: { ...mockList, wallpaper: 'market' },
      isDefault: true,
    });
    const pin = wrapper.find(`[data-testid="pin-${mockList.id}"]`);
    expect(pin.classes()).toContain('text-white');
    expect(pin.classes()).not.toContain('text-primary');
    expect(pin.classes()).not.toContain('bg-primary');
  });

  it('renders profile photos as CSS backgrounds (no img) to avoid long-press save menu', () => {
    const wrapper = mount(ListCard, {
      props: {
        list: mockList,
        members: [
          {
            uid: 'uid-1',
            email: 'a@x',
            displayName: 'A',
            lastLoginAt: 0,
            photoURL: 'https://example.com/photo.jpg',
          },
        ],
      },
      global: { plugins: [i18n, createPinia()] },
    });
    expect(wrapper.find('[data-testid="avatar-photo-uid-1"]').exists()).toBe(true);
    expect(wrapper.find('img').exists()).toBe(false);
    const style = wrapper.find('[data-testid="avatar-photo-uid-1"]').attributes('style') ?? '';
    expect(style).toContain('https://example.com/photo.jpg');
  });
});
