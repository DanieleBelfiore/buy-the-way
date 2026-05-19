import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import ListCard from '@/components/list/ListCard.vue';
import type { List } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { badge: { new: 'New' } } },
});

const mockList: List = {
  id: '01ABCDEFGH01234567890ABC12' as any,
  name: 'Spesa',
  ownerUid: 'uid-1',
  collaboratorUids: ['uid-1'],
  createdAt: 100,
  updatedAt: 200,
};

const mountCard = (props: { list: List; isNew?: boolean }) =>
  mount(ListCard, { props, global: { plugins: [i18n] } });

describe('ListCard', () => {
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

  it('switches text color to offwhite when wallpaper is present', () => {
    const wrapper = mountCard({ list: { ...mockList, wallpaper: '05.jpg' } });
    const title = wrapper.find('[data-testid="list-card"] span');
    expect(title.classes()).toContain('text-offwhite');
  });
});
