import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

import ListsView from '@/views/ListsView.vue';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      app: { name: 'Buy The Way', tagline: 'Your smart grocery list' },
      list: {
        new: 'New list',
        newPlaceholder: 'List name…',
        create: 'Create',
        cancel: 'Cancel',
        noLists: 'No lists yet',
        noListsHint: 'Tap + to create your first list',
      },
      badge: { new: 'New' },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lists', name: 'lists', component: ListsView },
    { path: '/lists/:id', name: 'list-detail', component: { template: '<div/>' } },
  ],
});

describe('ListsView', () => {
  const mockSubscribe = vi.fn();
  const mockCreateList = vi.fn();
  const mockLoadLastSeen = vi.fn();
  const mockMarkSeen = vi.fn();
  const mockIsNewForUser = vi.fn();

  const mountView = () =>
    mount(ListsView, { global: { plugins: [i18n, router] } });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    await router.push('/lists');
    await router.isReady();
    mockSubscribe.mockReturnValue(vi.fn());
    mockCreateList.mockResolvedValue('01ABC');
    mockLoadLastSeen.mockResolvedValue(undefined);
    mockMarkSeen.mockResolvedValue(undefined);
    mockIsNewForUser.mockReturnValue(false);
    vi.mocked(useListsStore).mockReturnValue({
      lists: [],
      loading: false,
      error: null,
      lastSeenLists: 0,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
    } as any);
  });

  it('calls subscribe on mount', async () => {
    mountView();
    await flushPromises();
    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it('shows empty state when lists is empty', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('No lists yet');
  });

  it('FAB is visible when create input is hidden', () => {
    const wrapper = mountView();
    expect(wrapper.find('[aria-label="New list"]').exists()).toBe(true);
  });

  it('FAB click shows create input and hides FAB', async () => {
    const wrapper = mountView();
    await wrapper.find('[aria-label="New list"]').trigger('click');
    expect(wrapper.find('input').exists()).toBe(true);
    expect(wrapper.find('[aria-label="New list"]').exists()).toBe(false);
  });

  it('cancel button hides create input', async () => {
    const wrapper = mountView();
    await wrapper.find('[aria-label="New list"]').trigger('click');
    await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click');
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('Enter key in create input calls createList', async () => {
    const wrapper = mountView();
    await wrapper.find('[aria-label="New list"]').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('Pasta');
    await input.trigger('keydown.enter');
    expect(mockCreateList).toHaveBeenCalledWith('Pasta');
  });

  it('Escape key in create input hides it', async () => {
    const wrapper = mountView();
    await wrapper.find('[aria-label="New list"]').trigger('click');
    await wrapper.find('input').trigger('keydown.escape');
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('renders a ListCard for each list', () => {
    vi.mocked(useListsStore).mockReturnValue({
      lists: [
        { id: '01A', name: 'Spesa', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 2 },
        { id: '01B', name: 'Pasta', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 3 },
      ],
      loading: false,
      error: null,
      lastSeenLists: 0,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);

    const wrapper = mountView();
    expect(wrapper.text()).toContain('Spesa');
    expect(wrapper.text()).toContain('Pasta');
  });

  it('shows skeleton when loading', () => {
    vi.mocked(useListsStore).mockReturnValue({
      lists: [],
      loading: true,
      error: null,
      lastSeenLists: 0,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);

    const wrapper = mountView();
    expect(wrapper.find('.animate-pulse').exists()).toBe(true);
  });

  it('calls unsubscribe on unmount', async () => {
    const unsub = vi.fn();
    mockSubscribe.mockReturnValue(unsub);
    const wrapper = mountView();
    await flushPromises();
    wrapper.unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('does not call createList when name is empty', async () => {
    const wrapper = mountView();
    await wrapper.find('[aria-label="New list"]').trigger('click');
    const input = wrapper.find('input');
    await input.setValue('   ');
    await input.trigger('keydown.enter');
    expect(mockCreateList).not.toHaveBeenCalled();
  });

  it('clicking a list card navigates to list-detail', async () => {
    await router.push('/lists');
    await router.isReady();

    vi.mocked(useListsStore).mockReturnValue({
      lists: [
        { id: '01ABCXYZ', name: 'Spesa', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 2 },
      ],
      loading: false,
      error: null,
      lastSeenLists: 0,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);

    const wrapper = mountView();
    await wrapper.find('[aria-label="Spesa"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('list-detail');
    expect(router.currentRoute.value.params.id).toBe('01ABCXYZ');
  });

  it('calls loadLastSeen on mount before subscribing', async () => {
    mountView();
    await flushPromises();
    expect(mockLoadLastSeen).toHaveBeenCalledOnce();
    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it('calls markSeen on unmount', () => {
    const wrapper = mountView();
    wrapper.unmount();
    expect(mockMarkSeen).toHaveBeenCalledOnce();
  });

  it('passes isNew=true to ListCard when isNewForUser returns true', async () => {
    mockIsNewForUser.mockImplementation((list: any) => list.id === '01NEW');
    vi.mocked(useListsStore).mockReturnValue({
      lists: [
        { id: '01NEW', name: 'Shared', ownerUid: 'someone-else', collaboratorUids: ['uid-me', 'someone-else'], createdAt: 1, updatedAt: 99 },
        { id: '01OLD', name: 'Mine', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 50 },
      ],
      loading: false,
      error: null,
      lastSeenLists: 70,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);

    const wrapper = mountView();
    await flushPromises();
    const badges = wrapper.findAll('[data-testid="new-badge"]');
    expect(badges).toHaveLength(1);
  });
});
