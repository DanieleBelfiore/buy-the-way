import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import AddCollaboratorView from '@/views/AddCollaboratorView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockAddCollaborator = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('@/stores/lists', () => ({
  useListsStore: () => ({
    addCollaborator: mockAddCollaborator,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useRoute: () => ({ params: { id: 'list-1' } }),
}));

describe('AddCollaboratorView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAddCollaborator.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
  });

  const mountView = () => mount(AddCollaboratorView, { global: { plugins: [i18n] } });

  test('idle state shows email input and lookupHint', () => {
    const w = mountView();
    expect(w.find('[data-testid="email-input"]').exists()).toBe(true);
    expect(w.html()).toContain('lookupHint');
  });

  test('found state shows found-card after known email lookup', async () => {
    const w = mountView();
    await w.find('[data-testid="email-input"]').setValue('alice@example.com');
    await w.find('[data-testid="email-input"]').trigger('keydown.enter');
    expect(w.find('[data-testid="found-card"]').exists()).toBe(true);
    expect(w.find('[data-testid="not-found-card"]').exists()).toBe(false);
  });

  test('not-found state shows not-found-card after unknown email', async () => {
    const w = mountView();
    await w.find('[data-testid="email-input"]').setValue('nobody@unknown.com');
    await w.find('[data-testid="email-input"]').trigger('keydown.enter');
    expect(w.find('[data-testid="not-found-card"]').exists()).toBe(true);
    expect(w.find('[data-testid="found-card"]').exists()).toBe(false);
  });

  test('add-btn calls addCollaborator with uid then navigates back', async () => {
    const w = mountView();
    await w.find('[data-testid="email-input"]').setValue('alice@example.com');
    await w.find('[data-testid="email-input"]').trigger('keydown.enter');
    await w.find('[data-testid="add-btn"]').trigger('click');
    expect(mockAddCollaborator).toHaveBeenCalledWith('list-1', expect.any(String));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  test('add-btn disabled in not-found state', async () => {
    const w = mountView();
    await w.find('[data-testid="email-input"]').setValue('nobody@unknown.com');
    await w.find('[data-testid="email-input"]').trigger('keydown.enter');
    const addBtn = w.find('[data-testid="add-btn"]');
    expect(addBtn.attributes('disabled')).toBeDefined();
  });
});
