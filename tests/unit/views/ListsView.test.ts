import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

const { mockCountsSync, mockCountsStop, liveCounts } = vi.hoisted(() => ({
  mockCountsSync: vi.fn(),
  mockCountsStop: vi.fn(),
  liveCounts: { value: {} as Record<string, { itemCount: number; urgentCount: number }> },
}));
vi.mock('@/stores/listItemCounts', () => ({
  useListItemCountsStore: () => ({
    get counts() {
      return liveCounts.value;
    },
    sync: mockCountsSync,
    stop: mockCountsStop,
  }),
}));

const { mockReorderList } = vi.hoisted(() => ({
  mockReorderList: vi.fn().mockResolvedValue(undefined),
}));

const { mockConsume, mockNotificationCount } = vi.hoisted(() => ({
  mockConsume: vi.fn().mockResolvedValue([]),
  mockNotificationCount: { value: 0 },
}));

vi.mock('@/services/lists.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/lists.service')>();
  return { ...actual, reorderList: mockReorderList };
});

vi.mock('vue-draggable-plus', async () => {
  const { defineComponent, h, ref } = await import('vue');
  return {
    VueDraggable: defineComponent({
      name: 'VueDraggable',
      props: {
        modelValue: { type: Array, default: () => [] },
        disabled: Boolean,
      },
      emits: ['start', 'end', 'update:modelValue'],
      setup(_props, { slots, expose }) {
        const rootEl = ref<HTMLElement | null>(null);
        expose({
          get $el() {
            return rootEl.value;
          },
        });
        return () => h('div', { ref: rootEl, class: 'vue-draggable-stub' }, slots.default?.());
      },
    }),
  };
});

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({
    items: { value: [] },
    count: mockNotificationCount,
    consume: mockConsume,
  }),
}));

import ListsView from '@/views/ListsView.vue';
import { FEATURES } from '@/domain/features';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { reorderList } from '@/services/lists.service';

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
        defaultSetToast: 'Default list: it will open automatically when you launch the app!',
        defaultClearedToast: "Default list cleared. You'll see all lists on next launch!",
        duplicateName: 'You already have a list with this name.',
      },
      badge: { new: 'New' },
      settings: { title: 'Settings' },
      stats: { title: 'Statistics', openButton: 'Statistics' },
      notifications: {
        title: 'Notifications',
        button: 'Notifications',
        close: 'Close',
        empty: 'No notifications.',
        badgeAria: 'Unread',
      },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lists', name: 'lists', component: ListsView },
    { path: '/lists/:id', name: 'list-detail', component: { template: '<div/>' } },
    { path: '/settings', name: 'settings', component: { template: '<div/>' } },
    { path: '/stats', name: 'stats', component: { template: '<div/>' } },
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
    mockNotificationCount.value = 0;
    liveCounts.value = {};
    mockConsume.mockResolvedValue([]);
    FEATURES.notifications = true;
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

  describe('live item counts', () => {
    const withLists = () =>
      vi.mocked(useListsStore).mockReturnValue({
        lists: [
          { id: '01A', name: 'Spesa', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 2, itemCount: 3 },
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

    it('tracks the items of every list on screen', async () => {
      withLists();
      mountView();
      await flushPromises();
      expect(mockCountsSync).toHaveBeenCalled();
      expect([...mockCountsSync.mock.calls.at(-1)![0]].sort()).toEqual(['01A', '01B']);
    });

    it('shows the real item count on the card, not the stored itemCount', async () => {
      withLists();
      liveCounts.value = { '01A': { itemCount: 8, urgentCount: 0 } };
      const wrapper = mountView();
      await flushPromises();
      const card = wrapper.get('[data-list-id="01A"]');
      const text = card.get('[data-testid="item-count"]').text();
      expect(text).toContain('8');
      expect(text).not.toContain('3');
    });
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
        // Subscription has not delivered yet - clearing now would be a
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
  });

  describe('drag reorder', () => {
    const seedLists = () => {
      vi.mocked(useListsStore).mockReturnValue({
        lists: [
          { id: '01A', name: 'Spesa', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 2, sortIndex: 200 },
          { id: '01B', name: 'Pasta', ownerUid: 'uid-me', collaboratorUids: ['uid-me'], createdAt: 1, updatedAt: 3, sortIndex: 100 },
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
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: null },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId: vi.fn().mockResolvedValue(undefined),
      } as any);
    };

    const draggable = (wrapper: ReturnType<typeof mountView>) =>
      wrapper.findComponent({ name: 'VueDraggable' });

    it('optimistically reorders and persists on drag end', async () => {
      seedLists();
      const wrapper = mountView();
      await flushPromises();
      mockReorderList.mockClear();
      await draggable(wrapper).vm.$emit('end', { oldIndex: 0, newIndex: 1 });
      await flushPromises();
      expect(reorderList).toHaveBeenCalledWith('01A', expect.any(Number));
      const cards = wrapper.findAll('[data-testid="list-card"]');
      expect(cards[0]!.text()).toContain('Pasta');
    });

    it('blocks reorder into the pinned slot at index 0', async () => {
      seedLists();
      vi.mocked(useAuthStore).mockReturnValue({
        user: { uid: 'uid-me', email: 'me@x.com', displayName: 'Me' },
        profile: { uid: 'uid-me', defaultListId: '01A' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        setDefaultListId: vi.fn().mockResolvedValue(undefined),
      } as any);
      const wrapper = mountView();
      await flushPromises();
      mockReorderList.mockClear();
      await draggable(wrapper).vm.$emit('end', { oldIndex: 1, newIndex: 0 });
      await flushPromises();
      expect(reorderList).not.toHaveBeenCalled();
    });
  });
});
