import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import SettingsView from '@/views/SettingsView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockSignOut = vi.fn();
const mockPush = vi.fn();

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { uid: 'u1', displayName: 'Daniele', email: 'daniele@example.com' },
    signOut: mockSignOut,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('SettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSignOut.mockReset();
    mockPush.mockReset();
  });

  const mountView = () => mount(SettingsView, { global: { plugins: [i18n] } });

  test('contains no theme/dark/light/auto strings in rendered HTML', () => {
    const w = mountView();
    const html = w.html().toLowerCase();
    expect(html).not.toContain('theme');
    expect(html).not.toContain('data-dark');
  });

  test('renders language toggle buttons', () => {
    const w = mountView();
    expect(w.find('[data-testid="lang-it"]').exists()).toBe(true);
    expect(w.find('[data-testid="lang-en"]').exists()).toBe(true);
  });

  test('logout button calls signOut then navigates to /login', async () => {
    const w = mountView();
    await w.find('[data-testid="logout-btn"]').trigger('click');
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  test('renders user display name', () => {
    const w = mountView();
    expect(w.text()).toContain('Daniele');
  });

  test('IT button sets locale to it', async () => {
    i18n.global.locale.value = 'en';
    const w = mountView();
    await w.find('[data-testid="lang-it"]').trigger('click');
    expect(i18n.global.locale.value).toBe('it');
  });

  test('EN button sets locale to en', async () => {
    i18n.global.locale.value = 'it';
    const w = mountView();
    await w.find('[data-testid="lang-en"]').trigger('click');
    expect(i18n.global.locale.value).toBe('en');
  });
});
