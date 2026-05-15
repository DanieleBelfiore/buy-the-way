import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import LoginView from '@/views/LoginView.vue';
import { useAuthStore } from '@/stores/auth';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      app: { name: 'Buy The Way', tagline: 'Your smart grocery list' },
      auth: {
        continueWithGoogle: 'Continue with Google',
        signingIn: 'Signing in…',
        signInError: 'Sign in failed. Please try again.',
      },
      error: { generic: 'Something went wrong.' },
    },
  },
});

describe('LoginView', () => {
  const mockSignIn = vi.fn();

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      ready: true,
      signIn: mockSignIn,
      signOut: vi.fn(),
      init: vi.fn(),
    } as any);
  });

  it('renders sign-in CTA button', () => {
    const wrapper = mount(LoginView, { global: { plugins: [i18n] } });
    expect(wrapper.find('[data-testid="sign-in-btn"]').exists()).toBe(true);
  });

  it('calls signIn on CTA click', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const wrapper = mount(LoginView, { global: { plugins: [i18n] } });
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  it('disables button while signing in', async () => {
    let resolve: () => void;
    mockSignIn.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    const wrapper = mount(LoginView, { global: { plugins: [i18n] } });
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-btn"]').attributes('disabled')).toBeDefined();
    resolve!();
  });

  it('shows error message on signIn failure', async () => {
    mockSignIn.mockRejectedValue(new Error('auth/popup-closed-by-user'));

    const wrapper = mount(LoginView, { global: { plugins: [i18n] } });
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-error"]').exists()).toBe(true);
  });

  it('re-enables button after sign-in error', async () => {
    mockSignIn.mockRejectedValue(new Error('error'));

    const wrapper = mount(LoginView, { global: { plugins: [i18n] } });
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-btn"]').attributes('disabled')).toBeUndefined();
  });
});
