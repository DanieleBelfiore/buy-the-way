import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }));
vi.mock('@/stores/auth', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/stores/catalog', () => ({ useCatalogStore: vi.fn() }));

import StatsView from '@/views/StatsView.vue';
import { useListsStore } from '@/stores/lists';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import type { CatalogEntry, List } from '@/domain/types';
import type { ULID } from '@/domain/id';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      stats: {
        title: 'Statistics',
        loading: 'Loading…',
        empty: 'Add a few items to see your stats.',
        totals: {
          lists: 'Lists',
          collaborators: 'Collaborators',
          catalog: 'Unique items',
          favorites: 'Favorites',
          totalUsage: 'Total purchases',
        },
        topItems: {
          title: 'Top items',
          subtitle: 'sub',
          usageLabel: 'Purchases',
        },
        categories: {
          title: 'By category',
          subtitle: 'sub',
          share: '{percent}% · {count}',
        },
      },
      category: {
        dairy: 'Dairy',
        meat: 'Meat',
        other: 'Other',
        fruit_vegetables: 'Fruit & Veg',
        fish: 'Fish',
        bakery: 'Bakery',
        beverages: 'Beverages',
        frozen: 'Frozen',
        cleaning: 'Cleaning',
        hygiene: 'Hygiene',
      },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/lists', name: 'lists', component: { template: '<div/>' } },
    { path: '/stats', name: 'stats', component: StatsView },
  ],
});

const e = (overrides: Partial<CatalogEntry>): CatalogEntry => ({
  id: 'id' as ULID,
  ownerUid: 'self',
  name: 'Milk',
  category: 'dairy',
  usageCount: 1,
  lastUsedAt: 0,
  ...overrides,
});

const list = (overrides: Partial<List>): List => ({
  id: 'L1' as ULID,
  name: 'List',
  ownerUid: 'self',
  collaboratorUids: ['self'],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('StatsView', () => {
  const mockListsSubscribe = vi.fn();
  const mockCatalogSubscribe = vi.fn();

  const mountView = () =>
    mount(StatsView, { global: { plugins: [i18n, router] } });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'self', email: 'a@b.com', displayName: 'A' },
    } as any);
    vi.mocked(useListsStore).mockReturnValue({
      lists: [],
      loading: false,
      subscribe: mockListsSubscribe.mockReturnValue(vi.fn()),
    } as any);
    vi.mocked(useCatalogStore).mockReturnValue({
      entries: [],
      loading: false,
      subscribe: mockCatalogSubscribe.mockReturnValue(vi.fn()),
    } as any);
    await router.push('/stats');
    await router.isReady();
  });

  it('shows empty state when no usage exists', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="stats-empty"]').exists()).toBe(true);
  });

  it('subscribes to lists and catalog on mount', () => {
    mountView();
    expect(mockListsSubscribe).toHaveBeenCalledOnce();
    expect(mockCatalogSubscribe).toHaveBeenCalledWith('self');
  });

  it('renders totals when catalog has data', async () => {
    vi.mocked(useCatalogStore).mockReturnValue({
      entries: [
        e({ name: 'Milk', usageCount: 6, pinned: true }),
        e({ name: 'Bread', category: 'bakery', usageCount: 4 }),
      ],
      loading: false,
      subscribe: mockCatalogSubscribe.mockReturnValue(vi.fn()),
    } as any);
    vi.mocked(useListsStore).mockReturnValue({
      lists: [list({ collaboratorUids: ['self', 'bob'] })],
      loading: false,
      subscribe: mockListsSubscribe.mockReturnValue(vi.fn()),
    } as any);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="stats-totals"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-total-lists"]').text()).toContain('1');
    expect(wrapper.find('[data-testid="stats-total-collaborators"]').text()).toContain('1');
    expect(wrapper.find('[data-testid="stats-total-totalUsage"]').text()).toContain('10');
  });

  it('renders top items + category sections when data present', async () => {
    vi.mocked(useCatalogStore).mockReturnValue({
      entries: [
        e({ name: 'Milk', usageCount: 6 }),
        e({ name: 'Bread', category: 'bakery', usageCount: 4 }),
      ],
      loading: false,
      subscribe: mockCatalogSubscribe.mockReturnValue(vi.fn()),
    } as any);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('[data-testid="stats-top-items"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-categories"]').exists()).toBe(true);
  });

  it('shows loading while stores still loading', () => {
    vi.mocked(useCatalogStore).mockReturnValue({
      entries: [],
      loading: true,
      subscribe: mockCatalogSubscribe.mockReturnValue(vi.fn()),
    } as any);
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Loading');
    expect(wrapper.find('[data-testid="stats-loading"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="skeleton-card"]').length).toBeGreaterThan(0);
  });
});
