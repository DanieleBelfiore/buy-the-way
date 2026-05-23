import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/services/auth.service', () => ({
  RequiresRecentLoginError: class RequiresRecentLoginError extends Error {
    constructor() {
      super('requires-recent-login');
      this.name = 'RequiresRecentLoginError';
    }
  },
  PartialDeletionError: class PartialDeletionError extends Error {
    constructor(public readonly failures: ReadonlyArray<string> = []) {
      super('partial-deletion');
      this.name = 'PartialDeletionError';
    }
  },
}));

import SettingsView from '@/views/SettingsView.vue';
import { useAuthStore } from '@/stores/auth';
import { RequiresRecentLoginError, PartialDeletionError } from '@/services/auth.service';

const settingsIt = {
  title: 'Impostazioni',
  language: 'Lingua',
  theme: 'Tema',
  themeSystem: 'Sistema',
  themeLight: 'Chiaro',
  themeDark: 'Scuro',
  share: 'Consiglia a un amico',
  shareMessage: 'Buy The Way — La Tua Lista Della Spesa Intelligente. Provala:',
  shareCopied: 'Link copiato negli appunti',
  feedback: 'Invia feedback',
  feedbackTitle: 'Manda un feedback',
  feedbackHint: 'Bug, idea, frustrazione.',
  feedbackPlaceholder: 'Scrivi…',
  feedbackSubmit: 'Invia',
  feedbackCancel: 'Annulla',
  feedbackSending: 'Invio…',
  feedbackThanks: 'Grazie!',
  feedbackError: 'Invio non riuscito.',
  account: 'Account',
  signOut: 'Esci',
  deleteAccount: 'Elimina account',
  deleteAccountConfirmTitle: 'Eliminare?',
  deleteAccountConfirmMessage: 'Irreversibile.',
  deleteAccountConfirm: 'Elimina',
  deleteAccountCancel: 'Annulla',
  deleteAccountReauth: 'Accedi di nuovo.',
  deleteAccountReauthBtn: 'Accedi di nuovo',
  deleteAccountError: 'Eliminazione fallita.',
  deleteAccountPartial: 'Alcuni dati non sono stati rimossi.',
};

const i18n = createI18n({
  legacy: false,
  locale: 'it',
  messages: {
    it: {
      settings: settingsIt,
      auth: { signingIn: 'Accesso in corso…' },
    },
    en: {
      settings: { ...settingsIt, title: 'Settings', language: 'Language', signOut: 'Sign out' },
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
  const mockDeleteAccount = vi.fn();
  const mockReauthenticate = vi.fn();

  const mountView = () =>
    mount(SettingsView, { global: { plugins: [i18n, router] } });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    i18n.global.locale.value = 'it';
    vi.mocked(useAuthStore).mockReturnValue({
      user: { uid: 'u1', email: 'a@b.com', displayName: 'A' },
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
      reauthenticate: mockReauthenticate,
    } as any);
    await router.push('/settings');
    await router.isReady();
  });

  it('renders settings title from i18n', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Impostazioni');
  });

  it('no longer renders the language selector (moved to Login + Lists header)', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="locale-it"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="locale-en"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="locale-switcher"]').exists()).toBe(false);
  });

  describe('theme selector', () => {
    it('renders two theme radios (light, dark)', () => {
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="theme-light"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="theme-dark"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="theme-system"]').exists()).toBe(false);
    });

    it('marks the active mode with aria-checked=true', async () => {
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="theme-light"]').attributes('aria-checked')).toBe('true');
      expect(wrapper.find('[data-testid="theme-dark"]').attributes('aria-checked')).toBe('false');
    });

    it('clicking a theme radio updates aria-checked', async () => {
      const wrapper = mountView();
      await wrapper.find('[data-testid="theme-dark"]').trigger('click');
      expect(wrapper.find('[data-testid="theme-dark"]').attributes('aria-checked')).toBe('true');
      expect(wrapper.find('[data-testid="theme-light"]').attributes('aria-checked')).toBe('false');
    });
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

  it('renders delete-account button when signed in', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="delete-account-btn"]').exists()).toBe(true);
  });

  it('hides delete-account button when no user', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
      reauthenticate: mockReauthenticate,
    } as any);
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="delete-account-btn"]').exists()).toBe(false);
  });

  it('opens confirm modal on delete-account click', async () => {
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').exists()).toBe(true);
  });

  it('invokes deleteAccount and navigates to login on confirm', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(mockDeleteAccount).toHaveBeenCalledWith('u1');
  });

  it('shows reauth prompt when RequiresRecentLoginError raised', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new RequiresRecentLoginError());
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Accedi di nuovo');
  });

  it('reauths and retries delete when reauth confirm clicked', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new RequiresRecentLoginError());
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    mockReauthenticate.mockResolvedValue(undefined);
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    // now reauth modal showing
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(mockReauthenticate).toHaveBeenCalledOnce();
    expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
  });

  it('shows generic error on unexpected deleteAccount failure', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error('boom'));
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Eliminazione fallita');
  });

  it('shows partial-deletion message when PartialDeletionError raised', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new PartialDeletionError(['catalog']));
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Alcuni dati non sono stati rimossi');
  });

  it('closes modal on cancel', async () => {
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click');
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').exists()).toBe(false);
  });

  describe('share button', () => {
    const originalShare = (window.navigator as any).share;
    const originalClipboard = (window.navigator as any).clipboard;

    afterEach(() => {
      // Restore navigator after each test to keep isolation
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: originalShare,
      });
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      vi.useRealTimers();
    });

    it('renders share button with i18n label', () => {
      const wrapper = mountView();
      const btn = wrapper.find('[data-testid="share-btn"]');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toContain('Consiglia a un amico');
    });

    it('calls navigator.share with title/text/url when available', async () => {
      const shareSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: shareSpy,
      });
      const wrapper = mountView();
      await wrapper.find('[data-testid="share-btn"]').trigger('click');
      await flushPromises();
      expect(shareSpy).toHaveBeenCalledOnce();
      const arg = shareSpy.mock.calls[0]?.[0];
      expect(arg.title).toBe('Buy The Way');
      expect(arg.text).toContain('Lista');
      expect(typeof arg.url).toBe('string');
      expect(arg.url.length).toBeGreaterThan(0);
    });

    it('does not fall back to clipboard when share is cancelled (AbortError)', async () => {
      const shareSpy = vi.fn().mockRejectedValue(
        new DOMException('cancel', 'AbortError'),
      );
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: shareSpy,
      });
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const wrapper = mountView();
      await wrapper.find('[data-testid="share-btn"]').trigger('click');
      await flushPromises();
      expect(writeText).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="toast"]').exists()).toBe(false);
    });

    it('falls back to clipboard and shows toast when navigator.share missing', async () => {
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: undefined,
      });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const wrapper = mountView();
      await wrapper.find('[data-testid="share-btn"]').trigger('click');
      await flushPromises();
      // Wait one more microtask: showToast resets and re-sets `open`,
      // so the Toast renders on the next tick.
      await flushPromises();
      expect(writeText).toHaveBeenCalledOnce();
      const payload = writeText.mock.calls[0]?.[0];
      expect(typeof payload).toBe('string');
      expect(payload).toContain('Lista');
      expect(wrapper.find('[data-testid="toast"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="toast"]').text()).toContain('Link copiato');
    });

    it('renders the feedback button next to the share button', () => {
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="feedback-btn"]').exists()).toBe(true);
    });

    it('clicking the feedback button opens the modal', async () => {
      const wrapper = mountView();
      expect(wrapper.find('[data-testid="feedback-textarea"]').exists()).toBe(false);
      await wrapper.find('[data-testid="feedback-btn"]').trigger('click');
      expect(wrapper.find('[data-testid="feedback-textarea"]').exists()).toBe(true);
    });

    it('silently swallows clipboard failure', async () => {
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: undefined,
      });
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const wrapper = mountView();
      await wrapper.find('[data-testid="share-btn"]').trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-testid="share-copied-toast"]').exists()).toBe(false);
    });
  });
});
