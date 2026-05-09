import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import ListsView from '@/views/ListsView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const NOW = Date.now();
const mockActiveLists = [
  {
    id: 'list-a', name: 'Spesa A', ownerUid: 'u1',
    collaboratorUids: [], deletedAt: null,
    createdAt: NOW - 2000, updatedAt: NOW - 1000,
  },
  {
    id: 'list-b', name: 'Spesa B', ownerUid: 'u1',
    collaboratorUids: [], deletedAt: null,
    createdAt: NOW - 5000, updatedAt: NOW - 3000,
  },
];

const mockCreate = vi.fn(() => 'new-list-id');
const mockPush = vi.fn();

vi.mock('@/stores/lists', () => ({
  useListsStore: () => ({
    active: mockActiveLists,
    trash: [],
    create: mockCreate,
  }),
}));

vi.mock('@/stores/items', () => ({
  useItemsStore: () => ({
    forList: () => [],
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { uid: 'u1', displayName: 'User', email: 'u@e.com' },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('ListsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockCreate.mockReset().mockReturnValue('new-list-id');
    mockPush.mockReset();
  });

  const mountView = () =>
    mount(ListsView, { global: { plugins: [i18n] } });

  test('renders all active list names', () => {
    const w = mountView();
    expect(w.text()).toContain('Spesa A');
    expect(w.text()).toContain('Spesa B');
  });

  test('lists ordered by updatedAt desc — most recent first', () => {
    const w = mountView();
    const cards = w.findAll('[data-testid="list-card"]');
    expect(cards[0]!.text()).toContain('Spesa A');
    expect(cards[1]!.text()).toContain('Spesa B');
  });

  test('FAB button is present', () => {
    const w = mountView();
    expect(w.find('[data-testid="new-list-fab"]').exists()).toBe(true);
  });

  test('clicking a list card navigates to /lists/:id', async () => {
    const w = mountView();
    await w.find('[data-testid="list-card"]').trigger('click');
    expect(mockPush).toHaveBeenCalledWith('/lists/list-a');
  });

  test('trash link is present', () => {
    const w = mountView();
    expect(w.find('[data-testid="trash-link"]').exists()).toBe(true);
  });
});
