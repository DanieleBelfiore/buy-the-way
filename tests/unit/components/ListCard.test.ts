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
      list: { setDefault: 'Set as default list', unsetDefault: 'Unset default list' },
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

const mountCard = (props: { list: List; isNew?: boolean; isDefault?: boolean }) =>
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

  it('does not render new badge by default', () => {
    const wrapper = mountCard({ list: mockList });
    expect(wrapper.find('[data-testid="new-badge"]').exists()).toBe(false);
  });

  it('renders new badge when isNew is true', () => {
    const wrapper = mountCard({ list: mockList, isNew: true });
    const badge = wrapper.find('[data-testid="new-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('New');
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
    const title = wrapper.find('[data-testid="list-card"] span');
    expect(title.classes()).toContain('text-white');
  });

  it('renders a star toggle button labelled "set as default" when not default', () => {
    const wrapper = mountCard({ list: mockList });
    const star = wrapper.find(`[data-testid="star-${mockList.id}"]`);
    expect(star.exists()).toBe(true);
    expect(star.attributes('aria-pressed')).toBe('false');
    expect(star.attributes('aria-label')).toBe('Set as default list');
  });

  it('flips the star button label to "unset" when isDefault is true', () => {
    const wrapper = mountCard({ list: mockList, isDefault: true });
    const star = wrapper.find(`[data-testid="star-${mockList.id}"]`);
    expect(star.attributes('aria-pressed')).toBe('true');
    expect(star.attributes('aria-label')).toBe('Unset default list');
  });

  it('emits toggle-default with the list id when the star is clicked', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.find(`[data-testid="star-${mockList.id}"]`).trigger('click');
    expect(wrapper.emitted('toggle-default')?.[0]).toEqual([mockList.id]);
  });

  it('does not also emit open when the star is clicked (stopPropagation)', async () => {
    const wrapper = mountCard({ list: mockList });
    await wrapper.find(`[data-testid="star-${mockList.id}"]`).trigger('click');
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
});
