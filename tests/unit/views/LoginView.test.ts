import { mount } from '@vue/test-utils';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import LoginView from '@/views/LoginView.vue';
import itMessages from '@/i18n/locales/it.json';
import enMessages from '@/i18n/locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: { it: itMessages, en: enMessages },
});

const mockSignIn = vi.fn();
const mockPush = vi.fn();

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: { value: false },
    user: { value: null },
    signIn: mockSignIn,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    currentUser: null,
    signIn: mockSignIn,
    signOut: vi.fn(),
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockSignIn.mockReset();
    mockPush.mockReset();
  });

  const mountView = () =>
    mount(LoginView, {
      global: { plugins: [i18n] },
    });

  test('contains no Apple button', () => {
    const w = mountView();
    const html = w.html().toLowerCase();
    expect(html).not.toContain('continueapple');
    expect(html).not.toContain('sign in with apple');
  });

  test('renders Wordmark text', () => {
    const w = mountView();
    expect(w.text()).toContain('Buy The Way');
  });

  test('renders Google CTA button', () => {
    const w = mountView();
    const googleBtn = w.find('[data-testid="google-cta"]');
    expect(googleBtn.exists()).toBe(true);
  });

  test('renders language toggle', () => {
    const w = mountView();
    const langToggle = w.find('[data-testid="lang-toggle"]');
    expect(langToggle.exists()).toBe(true);
  });

  test('Google CTA click calls signIn', async () => {
    const w = mountView();
    await w.find('[data-testid="google-cta"]').trigger('click');
    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  test('language toggle click switches locale', async () => {
    const w = mountView();
    const before = i18n.global.locale.value;
    await w.find('[data-testid="lang-toggle"]').trigger('click');
    expect(i18n.global.locale.value).not.toBe(before);
  });
});
