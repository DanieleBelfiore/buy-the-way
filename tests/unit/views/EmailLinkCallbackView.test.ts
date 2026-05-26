import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

const isMagicLinkCallbackMock = vi.fn();
const completeMagicLinkSignInMock = vi.fn();

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isMagicLinkCallback: (...args: unknown[]) => isMagicLinkCallbackMock(...args),
    completeMagicLinkSignIn: (...args: unknown[]) => completeMagicLinkSignInMock(...args),
  }),
}));

import EmailLinkCallbackView from '@/views/EmailLinkCallbackView.vue';

const messages = {
  en: {
    auth: {
      magicLink: {
        verifying: 'Signing you in…',
        confirmEmailTitle: 'Confirm your email',
        confirmEmailHint: 'Different device hint',
        emailLabel: 'Email address',
        complete: 'Continue',
        completing: 'Continuing…',
        errorTitle: 'Sign-in link invalid',
        backToLogin: 'Back to sign-in',
      },
    },
  },
};

const buildI18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages });

const buildRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/lists', name: 'lists', component: { template: '<div />' } },
      { path: '/auth/email-link-callback', name: 'email-link-callback', component: EmailLinkCallbackView },
    ],
  });

const mountCallback = async () => {
  const router = buildRouter();
  await router.push('/auth/email-link-callback');
  await router.isReady();
  return { wrapper: mount(EmailLinkCallbackView, { global: { plugins: [buildI18n(), router] } }), router };
};

describe('EmailLinkCallbackView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'https://app.test/auth/email-link-callback?oobCode=abc',
        origin: 'https://app.test',
      },
    });
  });

  it('bounces non-magic-link visits straight to /login', async () => {
    isMagicLinkCallbackMock.mockReturnValue(false);
    const { router } = await mountCallback();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('login');
    expect(completeMagicLinkSignInMock).not.toHaveBeenCalled();
  });

  it('happy path: completes sign-in then navigates to /lists', async () => {
    isMagicLinkCallbackMock.mockReturnValue(true);
    completeMagicLinkSignInMock.mockResolvedValue('uid-1');
    const { wrapper, router } = await mountCallback();
    await flushPromises();
    expect(completeMagicLinkSignInMock).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe('lists');
    expect(wrapper.find('[data-testid="magic-link-needs-email"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="magic-link-error"]').exists()).toBe(false);
  });

  it('falls back to email prompt when stored email is missing', async () => {
    isMagicLinkCallbackMock.mockReturnValue(true);
    completeMagicLinkSignInMock.mockRejectedValueOnce(new Error('missing email'));
    const { wrapper, router } = await mountCallback();
    await flushPromises();
    expect(wrapper.find('[data-testid="magic-link-needs-email"]').exists()).toBe(true);
    expect(router.currentRoute.value.name).toBe('email-link-callback');
  });

  it('submitting the fallback email retries completion and routes to /lists on success', async () => {
    isMagicLinkCallbackMock.mockReturnValue(true);
    completeMagicLinkSignInMock
      .mockRejectedValueOnce(new Error('missing email'))
      .mockResolvedValueOnce('uid-2');

    const { wrapper, router } = await mountCallback();
    await flushPromises();
    await wrapper.find('input[type="email"]').setValue('user@example.com');
    // Trigger the form's submit handler directly: jsdom does not always
    // bubble a submit-button click into the form's @submit listener.
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(completeMagicLinkSignInMock).toHaveBeenCalledTimes(2);
    const lastCall = completeMagicLinkSignInMock.mock.calls.at(-1)!;
    expect(lastCall[1]).toBe('user@example.com');
    expect(router.currentRoute.value.name).toBe('lists');
  });

  it('shows the error state when the manual retry also fails', async () => {
    isMagicLinkCallbackMock.mockReturnValue(true);
    completeMagicLinkSignInMock
      .mockRejectedValueOnce(new Error('missing email'))
      .mockRejectedValueOnce(new Error('expired'));

    const { wrapper } = await mountCallback();
    await flushPromises();
    await wrapper.find('input[type="email"]').setValue('user@example.com');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('[data-testid="magic-link-error"]').exists()).toBe(true);
  });
});
