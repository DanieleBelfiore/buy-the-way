import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

const LIST_ID = '01LIST00000000000000000001';
const UID = 'user-1';

const { pushItems, captureItemsSubscription, mockRecordListHistory } = vi.hoisted(() => {
  let onItemsChange: ((items: import('@/domain/types').Item[]) => void) | null = null;
  const captureItemsSubscription = (cb: (items: import('@/domain/types').Item[]) => void) => {
    onItemsChange = cb;
  };
  return {
    pushItems: (items: import('@/domain/types').Item[]) => onItemsChange?.(items),
    captureItemsSubscription,
    mockRecordListHistory: vi.fn().mockResolvedValue('hist-1'),
  };
});

vi.mock('@/services/history.service', () => ({
  recordListHistory: mockRecordListHistory,
}));

vi.mock('@/services/items.service', () => ({
  subscribeItems: vi.fn((_listId: string, onChange: (items: unknown[]) => void) => {
    captureItemsSubscription(onChange as (items: import('@/domain/types').Item[]) => void);
    return vi.fn();
  }),
}));

vi.mock('@/services/lists.service', () => ({
  reconcileListUrgentCount: vi.fn().mockResolvedValue(undefined),
  setListCategoryOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/notify.service', () => ({
  notifyListEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/composables/useSafeBack', () => ({
  useSafeBack: () => vi.fn(),
}));

vi.mock('@/composables/useCollapsedCategories', () => ({
  useCollapsedCategories: () => ({
    isCollapsed: () => false,
    toggle: vi.fn(),
    expandIfCollapsed: vi.fn(),
  }),
}));

vi.mock('@/composables/useCollaboratorProfiles', () => ({
  useCollaboratorProfiles: () => ({
    visibleMembers: [],
    overflowMembersCount: 0,
    initialFor: () => 'U',
    avatarColorFor: () => 'bg-rose-200',
  }),
}));

vi.mock('@/composables/useListDetailActions', () => ({
  useListDetailActions: () => ({
    bulkSel: {
      active: ref(false),
      selected: ref(new Set<string>()),
      count: ref(0),
      isEmpty: ref(true),
    },
    undoItemDelete: { schedule: vi.fn(), pending: ref(null) },
    inferCategoryForBulk: vi.fn(),
    closeDontSuggest: vi.fn(),
    pinnedNames: computed(() => new Set<string>()),
    editingItem: computed(() => null),
    editSheetOpen: computed(() => false),
    editingPinned: ref(false),
    photoBusy: ref(false),
    handleOpenItemEdit: vi.fn(),
    handleEditCancel: vi.fn(),
    handleEditUploadPhoto: vi.fn(),
    handleEditRemovePhoto: vi.fn(),
    handleEditSave: vi.fn(),
    handleShelfExclude: vi.fn(),
    excludeCandidate: ref(null),
    excludeModalOpen: computed(() => false),
    cancelExclude: vi.fn(),
    confirmExclude: vi.fn(),
    handleShelfAdd: vi.fn(),
    removeCandidate: ref(null),
    removeModalOpen: computed(() => false),
    cancelRemove: vi.fn(),
    confirmRemove: vi.fn(),
    handleRemoveItem: vi.fn(),
    pickerItem: ref(null),
    pickerOpen: computed(() => false),
    pickerBusy: ref(false),
    pickerError: ref(null),
    handleOpenMoveCopy: vi.fn(),
    handlePickerCancel: vi.fn(),
    handlePickerCopy: vi.fn(),
    handlePickerMove: vi.fn(),
    priorityItem: ref(null),
    priorityOpen: computed(() => false),
    handleRequestPriority: vi.fn(),
    handlePrioritySelect: vi.fn(),
    handlePriorityCancel: vi.fn(),
    bulkPickerOpen: ref(false),
    bulkPickerLabel: ref(''),
    openBulkPicker: vi.fn(),
    closeBulkPicker: vi.fn(),
    handleBulkPickerMove: vi.fn(),
    handleBulkPickerCopy: vi.fn(),
    handleSelectEnter: vi.fn(),
    handleSelectToggle: vi.fn(),
    cancelBulkSelection: vi.fn(),
    handleBulkDelete: vi.fn(),
    handleBulkPriority: vi.fn(),
    handleAddItem: vi.fn(),
    handleToggleChecked: vi.fn(),
    handleEmptyList: vi.fn(),
    bulkPasteOpen: ref(false),
    voiceAddOpen: ref(false),
    favoritesOpen: ref(false),
    openBulkPaste: vi.fn(),
    closeBulkPaste: vi.fn(),
    openVoiceAdd: vi.fn(),
    closeVoiceAdd: vi.fn(),
    openFavorites: vi.fn(),
    closeFavorites: vi.fn(),
    handleBulkPasteSubmit: vi.fn(),
    handleVoiceAddSubmit: vi.fn(),
    handleTogglePinned: vi.fn(),
    toggleToastOpen: ref(false),
    toggleToastMessage: ref(''),
    dontSuggestCandidate: ref(null),
    handleDontSuggestConfirm: vi.fn(),
  }),
}));

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/catalog', () => ({ useCatalogStore: vi.fn() }));
vi.mock('@/stores/listFavorites', () => ({ useListFavoritesStore: vi.fn() }));

import ListDetailView from '@/views/ListDetailView.vue';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import { useListFavoritesStore } from '@/stores/listFavorites';
import { recordListHistory } from '@/services/history.service';
import {
  clearListHistoryRecorded,
  markListHistoryRecorded,
  wasListHistoryRecorded,
} from '@/domain/listHistoryCycle';
import type { Item, List } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      list: {
        share: 'Share',
        shareTitle: '{name}',
        shareNoteLabel: 'Note',
        shareFooter: 'Footer',
        shareCopied: 'Copied',
        shareError: 'Error',
      },
      listSettings: {
        title: 'Settings',
        stats: { bought: 'Bought', users: 'Users' },
      },
      category: {
        dairy: 'Dairy',
        bakery: 'Bakery',
        fruit_vegetables: 'Fruit',
        meat: 'Meat',
        fish: 'Fish',
        beverages: 'Beverages',
        frozen: 'Frozen',
        cleaning: 'Cleaning',
        hygiene: 'Hygiene',
        other: 'Other',
      },
      item: {
        bulkSelectedCount: '{n} selected',
        bulkDelete: 'Delete',
        bulkMoveCopy: 'Move',
        bulkPriority: 'Priority',
        bulkCancel: 'Cancel',
        dontSuggestAgainTitle: 'Title',
        dontSuggestAgainMessage: '{name}',
        dontSuggestAgainAction: 'OK',
      },
      emptyList: { button: 'Empty' },
      favorites: { title: 'Favorites' },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lists', name: 'lists', component: { template: '<div/>' } },
    { path: '/lists/:id', name: 'list-detail', component: ListDetailView },
    { path: '/lists/:id/settings', name: 'list-settings', component: { template: '<div/>' } },
  ],
});

const sampleList: List = {
  id: LIST_ID as ULID,
  name: 'Spesa',
  ownerUid: UID,
  collaboratorUids: [UID],
  createdAt: 1,
  updatedAt: 2,
};

const item = (id: string, name: string, checked: boolean): Item => ({
  id: id as ULID,
  listId: LIST_ID as ULID,
  name,
  quantity: '1',
  category: 'dairy',
  note: '',
  checked,
  createdByUid: UID,
  createdAt: 1,
  updatedAt: 1,
});

const mountView = async () => {
  await router.push(`/lists/${LIST_ID}`);
  await router.isReady();
  return mount(ListDetailView, {
    global: {
      plugins: [i18n, router, createPinia()],
      stubs: {
        ItemAutocomplete: true,
        CategorySection: true,
        FavoritesSheet: true,
        ListFooterActionsMenu: true,
        EmptyListButton: true,
        ItemEditSheet: true,
        ListPickerSheet: true,
        PriorityPickerSheet: true,
        BulkPasteSheet: true,
        VoiceAddSheet: true,
        CompletionCelebration: true,
        ConfirmModal: true,
        Toast: true,
        SkeletonCard: true,
        ItemCountWithUrgent: true,
        VueDraggable: { template: '<div><slot /></div>' },
        DotLottieVue: true,
      },
    },
  });
};

describe('ListDetailView completion history', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    clearListHistoryRecorded(LIST_ID as ULID);
    vi.clearAllMocks();
    mockRecordListHistory.mockResolvedValue('hist-1');
    setActivePinia(createPinia());

    vi.mocked(useListsStore).mockReturnValue({
      lists: [sampleList],
      loading: false,
      error: null,
      initialized: true,
      lastSeenListMap: {},
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      loadLastSeen: vi.fn().mockResolvedValue(undefined),
      markSeen: vi.fn().mockResolvedValue(undefined),
    } as any);

    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: UID, email: 'u@example.com', displayName: 'User' },
      profile: null,
      ensureProfile: vi.fn().mockResolvedValue(undefined),
      setDefaultListId: vi.fn().mockResolvedValue(undefined),
    } as any);

    vi.mocked(useCatalogStore).mockReturnValue({
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    } as any);

    vi.mocked(useListFavoritesStore).mockReturnValue({
      rankedEntries: [],
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    } as any);
  });

  it('records list history when the last item becomes checked', async () => {
    await mountView();
    pushItems([item('I1', 'Milk', false), item('I2', 'Bread', false)]);
    await flushPromises();

    pushItems([item('I1', 'Milk', true), item('I2', 'Bread', true)]);
    await flushPromises();

    expect(recordListHistory).toHaveBeenCalledOnce();
    expect(recordListHistory).toHaveBeenCalledWith(
      LIST_ID,
      expect.arrayContaining([
        expect.objectContaining({ id: 'I1', checked: true }),
        expect.objectContaining({ id: 'I2', checked: true }),
      ]),
      UID,
      'completion',
    );
    expect(wasListHistoryRecorded(LIST_ID as ULID)).toBe(true);
  });

  it('does not record on first load when the list is already fully checked', async () => {
    await mountView();
    pushItems([item('I1', 'Milk', true), item('I2', 'Bread', true)]);
    await flushPromises();

    expect(recordListHistory).not.toHaveBeenCalled();
  });

  it('does not record when there is no authenticated user', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      profile: null,
      ensureProfile: vi.fn().mockResolvedValue(undefined),
      setDefaultListId: vi.fn().mockResolvedValue(undefined),
    } as any);

    await mountView();
    pushItems([item('I1', 'Milk', false)]);
    await flushPromises();
    pushItems([item('I1', 'Milk', true)]);
    await flushPromises();

    expect(recordListHistory).not.toHaveBeenCalled();
  });

  it('re-records after an item is unchecked and all are checked again', async () => {
    await mountView();
    pushItems([item('I1', 'Milk', false)]);
    await flushPromises();
    pushItems([item('I1', 'Milk', true)]);
    await flushPromises();
    pushItems([item('I1', 'Milk', false)]);
    await flushPromises();
    expect(wasListHistoryRecorded(LIST_ID as ULID)).toBe(false);

    pushItems([item('I1', 'Milk', true)]);
    await flushPromises();

    expect(recordListHistory).toHaveBeenCalledTimes(2);
  });

  it('does not double-record while the list stays complete', async () => {
    await mountView();
    pushItems([item('I1', 'Milk', false)]);
    await flushPromises();
    pushItems([item('I1', 'Milk', true)]);
    await flushPromises();
    markListHistoryRecorded(LIST_ID as ULID);

    pushItems([item('I1', 'Milk', true)]);
    await flushPromises();

    expect(recordListHistory).toHaveBeenCalledOnce();
  });
});
