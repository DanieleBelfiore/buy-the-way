import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/services/lists.service', () => ({
  addCollaborator: vi.fn(),
  removeCollaborator: vi.fn(),
  leaveList: vi.fn(),
  renameList: vi.fn(),
  deleteList: vi.fn(),
  UserNotFoundError: class extends Error {},
  CannotRemoveOwnerError: class extends Error {},
}));
vi.mock('@/services/users.service', () => ({
  getUsersByUids: vi.fn(),
}));

import ListSettingsView from '@/views/ListSettingsView.vue';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import {
  renameList,
  deleteList,
  addCollaborator,
  removeCollaborator,
  leaveList,
} from '@/services/lists.service';
import { getUsersByUids } from '@/services/users.service';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      listSettings: {
        title: 'List settings',
        rename: 'Rename',
        renamePlaceholder: 'New name…',
        save: 'Save',
        deleteList: 'Delete list',
        deleteConfirmTitle: 'Delete list permanently?',
        deleteConfirmMessage: 'This will permanently delete "{name}" and all its items. This action cannot be undone.',
        confirmDelete: 'Delete permanently',
        cancel: 'Cancel',
        members: 'Members',
      },
      collaborators: {
        add: 'Add collaborator',
        addPlaceholder: 'Email address…',
        submit: 'Add',
        notFound: 'No registered user with that email.',
        added: 'Collaborator added.',
        remove: 'Remove',
        leave: 'Leave list',
        owner: 'Owner',
      },
      error: { listNotFound: 'List not found.' },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lists', name: 'lists', component: { template: '<div/>' } },
    { path: '/lists/:id/settings', name: 'list-settings', component: ListSettingsView },
  ],
});

const ownerList = {
  id: 'list-1',
  name: 'Spesa',
  ownerUid: 'uid-me',
  collaboratorUids: ['uid-me', 'uid-bob'],
  createdAt: 1,
  updatedAt: 2,
};

const guestList = {
  ...ownerList,
  ownerUid: 'uid-other',
};

const mountView = async () => {
  await router.push('/lists/list-1/settings');
  await router.isReady();
  return mount(ListSettingsView, { global: { plugins: [i18n, router] } });
};

const mockSubscribe = vi.fn();

const setupStores = (list: typeof ownerList | null, selfUid: string) => {
  vi.mocked(useListsStore).mockReturnValue({
    lists: list ? [list] : [],
    loading: false,
    error: null,
    lastSeenLists: 0,
    subscribe: mockSubscribe,
    createList: vi.fn(),
    loadLastSeen: vi.fn().mockResolvedValue(undefined),
    markSeen: vi.fn().mockResolvedValue(undefined),
    isNewForUser: vi.fn().mockReturnValue(false),
  } as any);
  vi.mocked(useAuthStore).mockReturnValue({
    user: { uid: selfUid, email: 's@x.com', displayName: 'S' },
  } as any);
};

describe('ListSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(vi.fn());
    vi.mocked(getUsersByUids).mockResolvedValue([
      { uid: 'uid-me', email: 'me@x.com', displayName: 'Me', lastLoginAt: 0 },
      { uid: 'uid-bob', email: 'bob@x.com', displayName: 'Bob', lastLoginAt: 0 },
    ]);
  });

  it('renders not-found state when list missing', async () => {
    setupStores(null, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('List not found.');
  });

  it('owner sees rename, members, and delete sections', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="rename-section"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="delete-section"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Members');
  });

  it('non-owner does not see rename or delete sections', async () => {
    setupStores(guestList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="rename-section"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="delete-section"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="leave-list"]').exists()).toBe(true);
  });

  it('prefills name draft with current list name', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    const input = wrapper.find('input').element as HTMLInputElement;
    expect(input.value).toBe('Spesa');
  });

  it('rename Save button disabled when name unchanged', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.get('[data-testid="rename-save"]').attributes('disabled')).toBeDefined();
  });

  it('calls renameList service on Save with trimmed name', async () => {
    setupStores(ownerList, 'uid-me');
    vi.mocked(renameList).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.find('input').setValue('  Cucina  ');
    await wrapper.get('[data-testid="rename-save"]').trigger('click');
    await flushPromises();
    expect(renameList).toHaveBeenCalledWith('list-1', 'Cucina');
  });

  it('does not call renameList when input is empty', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.find('input').setValue('   ');
    await wrapper.get('[data-testid="rename-save"]').trigger('click');
    await flushPromises();
    expect(renameList).not.toHaveBeenCalled();
  });

  it('opens confirm modal on delete click', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await wrapper.get('[data-testid="delete-list"]').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  });

  it('calls deleteList and navigates to lists on confirm', async () => {
    setupStores(ownerList, 'uid-me');
    vi.mocked(deleteList).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[data-testid="delete-list"]').trigger('click');
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(deleteList).toHaveBeenCalledWith('list-1');
    expect(router.currentRoute.value.name).toBe('lists');
  });

  it('confirm message mentions irreversible action', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[data-testid="delete-list"]').trigger('click');
    expect(wrapper.text()).toContain('cannot be undone');
  });

  it('renders member chips from getUsersByUids', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('Me');
    expect(wrapper.text()).toContain('Bob');
  });

  it('owner sees Remove on non-owner members', async () => {
    setupStores(ownerList, 'uid-me');
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="remove-uid-bob"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remove-uid-me"]').exists()).toBe(false);
  });

  it('owner removing a member calls removeCollaborator and prunes UI', async () => {
    setupStores(ownerList, 'uid-me');
    vi.mocked(removeCollaborator).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[data-testid="remove-uid-bob"]').trigger('click');
    await flushPromises();
    expect(removeCollaborator).toHaveBeenCalledWith('list-1', 'uid-bob');
    expect(wrapper.find('[data-testid="collab-chip-uid-bob"]').exists()).toBe(false);
  });

  it('non-owner Leave triggers leaveList and routes to lists', async () => {
    setupStores(guestList, 'uid-me');
    vi.mocked(leaveList).mockResolvedValue(undefined);
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[data-testid="leave-list"]').trigger('click');
    await flushPromises();
    expect(leaveList).toHaveBeenCalledWith('list-1', 'uid-me');
    expect(router.currentRoute.value.name).toBe('lists');
  });

  it('add collaborator form calls addCollaborator and emits added', async () => {
    setupStores(ownerList, 'uid-me');
    vi.mocked(addCollaborator).mockResolvedValue({
      uid: 'uid-new',
      email: 'new@x.com',
      displayName: 'New',
      lastLoginAt: 0,
    });
    const wrapper = await mountView();
    await flushPromises();
    const emailInput = wrapper.find('input[type="email"]');
    expect(emailInput.exists()).toBe(true);
    await emailInput.setValue('new@x.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();
    expect(addCollaborator).toHaveBeenCalledWith('list-1', 'new@x.com');
  });

  it('subscribes to lists when store empty', async () => {
    setupStores(null, 'uid-me');
    await mountView();
    await flushPromises();
    expect(mockSubscribe).toHaveBeenCalled();
  });
});
