import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import ListSettingsView from '@/views/ListSettingsView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockSoftDelete = vi.fn();
const mockRename = vi.fn();
const mockLeave = vi.fn();
const mockPush = vi.fn();

const OWNER_UID = 'owner-uid';
const COLLAB_UID = 'collab-uid';

const mockList = {
  id: 'list-1',
  name: 'Spesa settimanale',
  ownerUid: OWNER_UID,
  collaboratorUids: [COLLAB_UID],
  deletedAt: null,
  createdAt: Date.now() - 1000,
  updatedAt: Date.now(),
};

vi.mock('@/stores/lists', () => ({
  useListsStore: () => ({
    getById: () => mockList,
    rename: mockRename,
    softDelete: mockSoftDelete,
    removeCollaborator: vi.fn(),
    leave: mockLeave,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { uid: OWNER_UID, displayName: 'Owner', email: 'owner@e.com' },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: { id: 'list-1' } }),
}));

describe('ListSettingsView — owner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSoftDelete.mockReset();
    mockRename.mockReset();
    mockPush.mockReset();
  });

  const mountView = () => mount(ListSettingsView, { global: { plugins: [i18n] } });

  test('renders rename input', () => {
    const w = mountView();
    expect(w.find('[data-testid="rename-input"]').exists()).toBe(true);
  });

  test('renders archive button', () => {
    const w = mountView();
    expect(w.find('[data-testid="archive-btn"]').exists()).toBe(true);
  });

  test('archive calls softDelete then navigates home', async () => {
    const w = mountView();
    await w.find('[data-testid="archive-btn"]').trigger('click');
    expect(mockSoftDelete).toHaveBeenCalledWith('list-1');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  test('owner does not see leave button', () => {
    const w = mountView();
    expect(w.find('[data-testid="leave-btn"]').exists()).toBe(false);
  });

  test('no theme/dark/light/auto strings in HTML', () => {
    const w = mountView();
    expect(w.html().toLowerCase()).not.toContain('theme');
  });
});
