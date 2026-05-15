import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ListCard from '@/components/list/ListCard.vue';
import type { List } from '@/domain/types';

const mockList: List = {
  id: '01ABCDEFGH01234567890ABC12' as any,
  name: 'Spesa',
  ownerUid: 'uid-1',
  collaboratorUids: ['uid-1'],
  deletedAt: null,
  createdAt: 100,
  updatedAt: 200,
};

describe('ListCard', () => {
  it('renders the list name', () => {
    const wrapper = mount(ListCard, { props: { list: mockList } });
    expect(wrapper.text()).toContain('Spesa');
  });

  it('has aria-label matching list name', () => {
    const wrapper = mount(ListCard, { props: { list: mockList } });
    expect(wrapper.attributes('aria-label')).toBe('Spesa');
  });

  it('emits open with list id on click', async () => {
    const wrapper = mount(ListCard, { props: { list: mockList } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('open')?.[0]).toEqual([mockList.id]);
  });
});
