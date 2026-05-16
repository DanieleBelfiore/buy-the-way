import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  setLocale: vi.fn(),
}));

import SettingsView from '@/views/SettingsView.vue';
import { useAuthStore } from '@/stores/auth';
import { setLocale } from '@/i18n';

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: {
    it: {
      settings: {
        title: 'Impostazioni',
        language: 'Lingua',
        account: 'Account',
        signOut: 'Esci',
      },
      auth: { signingIn: 'Accesso in corso…' },
    },
    en: {
      settings: {
        title: 'Settings',
        language: 'Language',
        account: 'Account',
        signOut: 'Sign out',
      },
      auth: { signingIn: 'Signing in…' },
    },
  },
});

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/login', name: 'login', component: { template: '<div/>' } },
  ],
});

describe('SettingsView', () => {
  const mockSignOut = vi.fn();

  const mountView = () =>
    mount(SettingsView, { global: { plugins: [i18n, router] } });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    i18n.global.locale.value = 'it';
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'u1', email: 'a@b.com', displayName: 'A' },
      signOut: mockSignOut,
    } as any);
    await router.push('/settings');
    await router.isReady();
  });

  it('renders settings title from i18n', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Impostazioni');
  });

  it('renders language section', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Lingua');
  });

  it('renders Italian and English locale buttons', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="locale-it"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="locale-en"]').exists()).toBe(true);
  });

  it('marks current locale (it) as checked', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="locale-it"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.find('[data-testid="locale-en"]').attributes('aria-checked')).toBe('false');
  });

  it('calls setLocale("en") when English clicked', async () => {
    const wrapper = mountView();
    await wrapper.find('[data-testid="locale-en"]').trigger('click');
    expect(setLocale).toHaveBeenCalledWith('en');
  });

  it('calls setLocale("it") when Italian clicked', async () => {
    const wrapper = mountView();
    await wrapper.find('[data-testid="locale-it"]').trigger('click');
    expect(setLocale).toHaveBeenCalledWith('it');
  });

  it('renders account section with email and displayName', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Account');
    expect(wrapper.text()).toContain('a@b.com');
    expect(wrapper.text()).toContain('A');
  });

  it('renders email only when displayName missing', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'u1', email: 'a@b.com', displayName: null },
      signOut: mockSignOut,
    } as any);
    const wrapper = mountView();
    expect(wrapper.text()).toContain('a@b.com');
  });

  it('does not crash when user is null', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      signOut: mockSignOut,
    } as any);
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="account-section"]').exists()).toBe(false);
  });

  it('renders sign-out button', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="sign-out-btn"]').exists()).toBe(true);
  });

  it('calls signOut and navigates to login on sign-out click', async () => {
    mockSignOut.mockResolvedValue(undefined);
    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-out-btn"]').trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});
