import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import CollaboratorList from '@/components/collaborators/CollaboratorList.vue';
import type { UserProfile } from '@/domain/types';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      collaborators: {
        remove: 'Remove',
        leave: 'Leave list',
        owner: 'Owner',
      },
    },
  },
});

const owner: UserProfile = { uid: 'owner-1', email: 'o@x.com', displayName: 'Owner', lastLoginAt: 0 };
const bob: UserProfile = { uid: 'bob-2', email: 'b@x.com', displayName: 'Bob', lastLoginAt: 0 };
const eve: UserProfile = { uid: 'eve-3', email: 'e@x.com', displayName: 'Eve', lastLoginAt: 0 };

const mountList = (props: {
  members: UserProfile[];
  ownerUid: string;
  selfUid: string;
}) =>
  mount(CollaboratorList, {
    props,
    global: { plugins: [i18n] },
    attachTo: document.body,
  });

describe('CollaboratorList', () => {
  it('renders one chip per member with displayName', () => {
    const wrapper = mountList({
      members: [owner, bob],
      ownerUid: 'owner-1',
      selfUid: 'owner-1',
    });
    expect(wrapper.text()).toContain('Owner');
    expect(wrapper.text()).toContain('Bob');
    wrapper.unmount();
  });

  it('falls back to email when displayName empty', () => {
    const member: UserProfile = { uid: 'x', email: 'x@y.com', displayName: '', lastLoginAt: 0 };
    const wrapper = mountList({
      members: [member],
      ownerUid: 'owner-1',
      selfUid: 'owner-1',
    });
    expect(wrapper.text()).toContain('x@y.com');
    wrapper.unmount();
  });

  it('shows Owner badge next to owner', () => {
    const wrapper = mountList({
      members: [owner, bob],
      ownerUid: 'owner-1',
      selfUid: 'bob-2',
    });
    const ownerChip = wrapper.get('[data-testid="collab-chip-owner-1"]');
    expect(ownerChip.text()).toContain('Owner');
    wrapper.unmount();
  });

  it('owner sees Remove button on every non-owner member', () => {
    const wrapper = mountList({
      members: [owner, bob, eve],
      ownerUid: 'owner-1',
      selfUid: 'owner-1',
    });
    expect(wrapper.find('[data-testid="remove-bob-2"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-eve-3"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-owner-1"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('owner does not see Leave button', () => {
    const wrapper = mountList({
      members: [owner, bob],
      ownerUid: 'owner-1',
      selfUid: 'owner-1',
    });
    expect(wrapper.find('[data-testid="leave-list"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('non-owner sees only Leave button (no Remove anywhere)', () => {
    const wrapper = mountList({
      members: [owner, bob, eve],
      ownerUid: 'owner-1',
      selfUid: 'bob-2',
    });
    expect(wrapper.find('[data-testid="leave-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-bob-2"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remove-eve-3"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remove-owner-1"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('emits remove(uid) when owner taps Remove', async () => {
    const wrapper = mountList({
      members: [owner, bob],
      ownerUid: 'owner-1',
      selfUid: 'owner-1',
    });
    await wrapper.get('[data-testid="remove-bob-2"]').trigger('click');
    expect(wrapper.emitted('remove')).toBeTruthy();
    expect(wrapper.emitted('remove')![0]).toEqual(['bob-2']);
    wrapper.unmount();
  });

  it('emits leave when non-owner taps Leave', async () => {
    const wrapper = mountList({
      members: [owner, bob],
      ownerUid: 'owner-1',
      selfUid: 'bob-2',
    });
    await wrapper.get('[data-testid="leave-list"]').trigger('click');
    expect(wrapper.emitted('leave')).toBeTruthy();
    wrapper.unmount();
  });
});
