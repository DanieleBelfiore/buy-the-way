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
        newPlaceholder: 'List name',
        create: 'Create',
        cancel: 'Cancel',
        noLists: 'No lists yet',
        noListsHint: 'Tap + to create your first list',
        setDefault: 'Set as default list',
        unsetDefault: 'Unset default list',
      },
      badge: { new: 'New' },
      settings: { title: 'Settings' },
      stats: { title: 'Statistics', openButton: 'Statistics' },
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
      initialized: true,
      subscribe: mockSubscribe,
      createList: mockCreateList,
      loadLastSeen: mockLoadLastSeen,
      markSeen: mockMarkSeen,
      isNewForUser: mockIsNewForUser,
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
      profile: null,
      ensureProfile: vi.fn().mockResolvedValue(undefined),
      setDefaultListId: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  it('calls subscribe on mount', async () => {
    mountView();
    await flushPromises();
    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it('renders stats button in header', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="open-stats"]').exists()).toBe(true);
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
      initialized: true,
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
      initialized: false,
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
      initialized: true,
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

  it('does NOT call markSeen on unmount (per-list seen now happens on detail mount)', () => {
    const wrapper = mountView();
    wrapper.unmount();
    expect(mockMarkSeen).not.toHaveBeenCalled();
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
      initialized: true,
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

  describe('default-list star', () => {
    const seedLists = () => {
      vi.mocked(useListsStore).mockReturnValue({
        lists: [
          { id: '01A', name: 'Spesa', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 2 },
          { id: '01B', name: 'Pasta', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 3 },
        ],
        loading: false,
        error: null,
        initialized: true,
        lastSeenLists: 0,
        subscribe: mockSubscribe,
        createList: mockCreateList,
        loadLastSeen: mockLoadLastSeen,
        markSeen: mockMarkSeen,
        isNewForUser: mockIsNewForUser,
      } as any);
    };

    it('calls ensureProfile on mount so the star reflects persisted state', async () => {
      const ensureProfile = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: null,
        ensureProfile,
        setDefaultListId: vi.fn().mockResolvedValue(undefined),
      } as any);
      mountView();
      await flushPromises();
      expect(ensureProfile).toHaveBeenCalled();
    });

    it('clicking star on a non-default list sets it as default', async () => {
      seedLists();
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: null },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      const wrapper = mountView();
      await flushPromises();
      await wrapper.find('[data-testid="star-01A"]').trigger('click');
      expect(setDefaultListId).toHaveBeenCalledWith('01A');
    });

    it('clicking star on the current default list clears it (null)', async () => {
      seedLists();
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01A' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      const wrapper = mountView();
      await flushPromises();
      await wrapper.find('[data-testid="star-01A"]').trigger('click');
      expect(setDefaultListId).toHaveBeenCalledWith(null);
    });

    it('clicking star on a different list replaces the current default', async () => {
      seedLists();
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01A' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      const wrapper = mountView();
      await flushPromises();
      await wrapper.find('[data-testid="star-01B"]').trigger('click');
      expect(setDefaultListId).toHaveBeenCalledWith('01B');
    });

    it('auto-clears defaultListId when target list is no longer in the user\'s lists', async () => {
      vi.mocked(useListsStore).mockReturnValue({
        // 01STALE is the default but not present in the subscribed lists.
        lists: [
          { id: '01A', name: 'Spesa', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 2 },
        ],
        loading: false,
        error: null,
        lastSeenLists: 0,
        initialized: true,
        subscribe: mockSubscribe,
        createList: mockCreateList,
        loadLastSeen: mockLoadLastSeen,
        markSeen: mockMarkSeen,
        isNewForUser: mockIsNewForUser,
      } as any);
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01STALE' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      mountView();
      await flushPromises();
      expect(setDefaultListId).toHaveBeenCalledWith(null);
    });

    it('does NOT clear defaultListId before the first snapshot has arrived', async () => {
      vi.mocked(useListsStore).mockReturnValue({
        lists: [],
        loading: false,
        error: null,
        lastSeenLists: 0,
        // Subscription has not delivered yet — clearing now would be a
        // spurious clear of the user's freshly-set default.
        initialized: false,
        subscribe: mockSubscribe,
        createList: mockCreateList,
        loadLastSeen: mockLoadLastSeen,
        markSeen: mockMarkSeen,
        isNewForUser: mockIsNewForUser,
      } as any);
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01STALE' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      mountView();
      await flushPromises();
      expect(setDefaultListId).not.toHaveBeenCalled();
    });

    it('does NOT clear defaultListId when the target list is still present', async () => {
      seedLists();
      const setDefaultListId = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01A' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId,
      } as any);
      mountView();
      await flushPromises();
      expect(setDefaultListId).not.toHaveBeenCalled();
    });

    it('star on default list reports aria-pressed=true', async () => {
      seedLists();
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01B' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId: vi.fn().mockResolvedValue(undefined),
      } as any);
      const wrapper = mountView();
      await flushPromises();
      expect(wrapper.find('[data-testid="star-01A"]').attributes('aria-pressed')).toBe('false');
      expect(wrapper.find('[data-testid="star-01B"]').attributes('aria-pressed')).toBe('true');
    });
  });
});
