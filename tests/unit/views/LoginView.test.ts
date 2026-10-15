import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import { reactive } from 'vue';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import LoginView from '@/views/LoginView.vue';
import { useAuthStore } from '@/stores/auth';
import { saveReturnTo } from '@/domain/returnTo';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      app: { name: 'Buy The Way', tagline: 'Your smart grocery list', madeByPrefix: 'Made by ', madeBySuffix: ' with ❤️' },
      auth: {
        continueWithGoogle: 'Continue with Google',
        signingIn: 'Signing in…',
        signInError: 'Sign in failed. Please try again.',
        magicLink: {
          show: 'Sign in with email',
          hide: 'Sign in with Google',
          emailLabel: 'Email address',
          send: 'Send link',
          sending: 'Sending…',
          sentNotice: 'Check {email}',
        },
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
    { path: '/oauth/authorize', name: 'oauth-authorize', component: { template: '<div/>' } },
  ],
});

// Mounted views keep their auth.user watcher alive; unmount between tests so a
// later sign-in is not handled by every view mounted so far.
enableAutoUnmount(afterEach);

describe('LoginView', () => {
  const mockSignIn = vi.fn();
  const mockSendMagicLink = vi.fn();
  // reactive so that watch(() => auth.user) in LoginView tracks changes
  const mockStore = reactive({
    user: null as { uid: string; email: string; displayName: string } | null,
    ready: true,
    signIn: mockSignIn,
    signOut: vi.fn(),
    init: vi.fn(),
    sendMagicLink: mockSendMagicLink,
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

  it('redirects to lists when auth.user becomes non-null', async () => {
    mountView();

    // Simulate Firebase resolving auth state (e.g. after signInWithPopup)
    mockStore.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' };
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('lists');
  });

  it('returns to the remembered consent URL after sign-in (MCP)', async () => {
    localStorage.clear();
    saveReturnTo('/oauth/authorize?client_id=c&state=s');
    mountView();
    mockStore.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' };
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/oauth/authorize?client_id=c&state=s');
  });

  describe('S2.3: magic-link sign-in', () => {
    it('calls sendMagicLink with the entered email and shows the sent notice', async () => {
      mockSendMagicLink.mockResolvedValue(undefined);
      const wrapper = mountView();
      await wrapper.find('[data-testid="magic-link-toggle"]').trigger('click');
      await wrapper.find('input[type="email"]').setValue('user@example.com');
      await wrapper.find('[data-testid="magic-link-send"]').trigger('click');
      await flushPromises();
      expect(mockSendMagicLink).toHaveBeenCalledWith('user@example.com', 'en');
      expect(wrapper.find('[data-testid="magic-link-sent"]').exists()).toBe(true);
      expect(wrapper.find('input[type="email"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="magic-link-send"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="magic-link-cancel"]').exists()).toBe(false);
    });
  });
});
