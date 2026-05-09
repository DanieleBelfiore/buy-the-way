import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import TrashView from '@/views/TrashView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockRestore = vi.fn();
const trashFixtures = [
  { id: 'del-1', name: 'Vecchia spesa', deletedAt: Date.now() - 86400000 },
  { id: 'del-2', name: 'Altra lista', deletedAt: Date.now() - 172800000 },
];

vi.mock('@/stores/lists', () => ({
  useListsStore: () => ({
    trash: trashFixtures,
    restore: mockRestore,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('TrashView — with items', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockRestore.mockReset();
  });

  const mountView = () =>
    mount(TrashView, { global: { plugins: [i18n] } });

  test('renders deleted list names', () => {
    const w = mountView();
    expect(w.text()).toContain('Vecchia spesa');
    expect(w.text()).toContain('Altra lista');
  });

  test('renders a restore button per deleted list', () => {
    const w = mountView();
    expect(w.findAll('[data-testid="restore-btn"]').length).toBe(2);
  });

  test('restore button calls lists.restore with correct id', async () => {
    const w = mountView();
    await w.find('[data-testid="restore-btn"]').trigger('click');
    expect(mockRestore).toHaveBeenCalledWith('del-1');
  });

  test('has no delete-forever button', () => {
    const w = mountView();
    expect(w.find('[data-testid="delete-forever-btn"]').exists()).toBe(false);
  });
});
