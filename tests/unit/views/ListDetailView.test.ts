import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import ListDetailView from '@/views/ListDetailView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockToggleChecked = vi.fn();
const mockAdd = vi.fn();
const mockPush = vi.fn();

const LIST_ID = 'list-1';

const mockList = {
  id: LIST_ID,
  name: 'Spesa settimanale',
  ownerUid: 'uid-owner',
  collaboratorUids: [],
  deletedAt: null,
  createdAt: Date.now() - 5000,
  updatedAt: Date.now(),
};

const uncheckedItem = {
  id: 'i1',
  listId: LIST_ID,
  name: 'Latte',
  quantity: '',
  category: 'dairy',
  note: '',
  checked: false,
  createdByUid: 'uid-owner',
  createdAt: Date.now() - 2000,
  updatedAt: Date.now(),
};

const checkedItem = {
  id: 'i2',
  listId: LIST_ID,
  name: 'Yogurt',
  quantity: '',
  category: 'dairy',
  note: '',
  checked: true,
  createdByUid: 'uid-owner',
  createdAt: Date.now() - 1000,
  updatedAt: Date.now(),
};

vi.mock('@/stores/lists', () => ({
  useListsStore: () => ({
    getById: () => mockList,
  }),
}));

vi.mock('@/stores/items', () => ({
  useItemsStore: () => ({
    forList: () => [uncheckedItem, checkedItem],
    add: mockAdd,
    toggleChecked: mockToggleChecked,
  }),
}));

vi.mock('@/stores/catalog', () => ({
  useCatalogStore: () => ({
    entries: [],
    ranked: () => [],
    recordUse: vi.fn(),
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  useRoute: () => ({ params: { id: LIST_ID } }),
}));

describe('ListDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockToggleChecked.mockReset();
    mockAdd.mockReset();
    mockPush.mockReset();
  });

  const mountView = () => mount(ListDetailView, { global: { plugins: [i18n] } });

  test('renders list name in header', () => {
    const w = mountView();
    expect(w.html()).toContain('Spesa settimanale');
  });

  test('autocomplete input renders', () => {
    const w = mountView();
    expect(w.find('[data-testid="autocomplete"]').exists()).toBe(true);
  });

  test('renders category section for dairy (has items)', () => {
    const w = mountView();
    expect(w.find('[data-testid="category-section-dairy"]').exists()).toBe(true);
  });

  test('does not render category section for beverages (no items)', () => {
    const w = mountView();
    expect(w.find('[data-testid="category-section-beverages"]').exists()).toBe(false);
  });

  test('checked items appear after unchecked within same category', () => {
    const w = mountView();
    const section = w.find('[data-testid="category-section-dairy"]');
    const items = section.findAll('[data-checked]');
    expect(items.length).toBe(2);
    expect(items[0]?.attributes('data-checked')).toBe('false');
    expect(items[1]?.attributes('data-checked')).toBe('true');
  });
});
