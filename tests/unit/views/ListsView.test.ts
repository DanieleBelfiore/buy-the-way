import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));

import ListsView from '@/views/ListsView.vue';
import { useListsStore } from '@/stores/lists';

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

  const mountView = () =>
    mount(ListsView, { global: { plugins: [i18n, router] } });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(vi.fn());
    mockCreateList.mockResolvedValue('01ABC');
    vi.mocked(useListsStore).mockReturnValue({
      lists: [],
      loading: false,
      error: null,
      subscribe: mockSubscribe,
      createList: mockCreateList,
    } as any);
  });

  it('calls subscribe on mount', () => {
    mountView();
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
        { id: '01A', name: 'Spesa', ownerUid: 'u', collaboratorUids: ['u'], deletedAt: null, createdAt: 1, updatedAt: 2 },
        { id: '01B', name: 'Pasta', ownerUid: 'u', collaboratorUids: ['u'], deletedAt: null, createdAt: 1, updatedAt: 3 },
      ],
      loading: false,
      error: null,
      subscribe: mockSubscribe,
      createList: mockCreateList,
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
      subscribe: mockSubscribe,
      createList: mockCreateList,
    } as any);

    const wrapper = mountView();
    expect(wrapper.find('.animate-pulse').exists()).toBe(true);
  });

  it('calls unsubscribe on unmount', () => {
    const unsub = vi.fn();
    mockSubscribe.mockReturnValue(unsub);
    const wrapper = mountView();
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
        { id: '01ABCXYZ', name: 'Spesa', ownerUid: 'u', collaboratorUids: ['u'], deletedAt: null, createdAt: 1, updatedAt: 2 },
      ],
      loading: false,
      error: null,
      subscribe: mockSubscribe,
      createList: mockCreateList,
    } as any);

    const wrapper = mountView();
    await wrapper.find('[aria-label="Spesa"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('list-detail');
    expect(router.currentRoute.value.params.id).toBe('01ABCXYZ');
  });
});
