import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { reactive } from 'vue';

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

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/lists', name: 'lists', component: { template: '<div/>' } },
  ],
});

describe('LoginView', () => {
  const mockSignIn = vi.fn();
  // reactive so that watch(() => auth.user) in LoginView tracks changes
  const mockStore = reactive({
    user: null as { uid: string; email: string; displayName: string } | null,
    ready: true,
    signIn: mockSignIn,
    signOut: vi.fn(),
    init: vi.fn(),
  });

  const mountView = () => mount(LoginView, { global: { plugins: [i18n, router] } });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockStore.user = null;
    vi.mocked(useAuthStore).mockReturnValue(mockStore as any);
    await router.push('/login');
    await router.isReady();
  });

  it('renders sign-in CTA button', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="sign-in-btn"]').exists()).toBe(true);
  });

  it('calls signIn on CTA click', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    expect(mockSignIn).toHaveBeenCalledOnce();
  });

  it('disables button while signing in', async () => {
    let resolve: () => void;
    mockSignIn.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-btn"]').attributes('disabled')).toBeDefined();
    resolve!();
  });

  it('shows error message on signIn failure', async () => {
    mockSignIn.mockRejectedValue(new Error('auth/popup-closed-by-user'));

    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-error"]').exists()).toBe(true);
  });

  it('re-enables button after sign-in error', async () => {
    mockSignIn.mockRejectedValue(new Error('error'));

    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-in-btn"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="sign-in-btn"]').attributes('disabled')).toBeUndefined();
  });

  it('redirects to lists when auth.user becomes non-null', async () => {
    mountView();

    // Simulate Firebase resolving auth state (e.g. after signInWithPopup)
    mockStore.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' };
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('lists');
  });
});
