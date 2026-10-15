import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

// Provide a "fresh" lastSignInTime so the C1 pre-flight reauth check in
// SettingsView.runDelete passes and the test exercises the full delete path
// rather than short-circuiting to the reauth prompt.
const mockGetAuth = vi.fn(() => ({
  currentUser: {
    metadata: { lastSignInTime: new Date().toISOString() },
  },
}));
vi.mock('firebase/auth', () => ({
  getAuth: () => mockGetAuth(),
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

const connectedApps = vi.hoisted(() => ({
  subscribeConnectedApps: vi.fn(() => () => {}),
  revokeConnectedApp: vi.fn(),
}));
vi.mock('@/services/connectedApps.service', () => connectedApps);

import SettingsView from '@/views/SettingsView.vue';
import { useAuthStore } from '@/stores/auth';
import { RequiresRecentLoginError, PartialDeletionError } from '@/services/auth.service';

const settingsIt = {
  title: 'Impostazioni',
  language: 'Lingua',
  languageIt: 'Italiano',
  languageEn: 'English',
  theme: 'Tema',
  themeSystem: 'Sistema',
  themeLight: 'Chiaro',
  themeDark: 'Scuro',
  share: 'Consiglia a un amico',
  shareMessage: 'Buy The Way - La Tua Lista Della Spesa Intelligente. Provala:',
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

  it('calls signOut and navigates to login on sign-out click', async () => {
    mockSignOut.mockResolvedValue(undefined);
    const wrapper = mountView();
    await wrapper.find('[data-testid="sign-out-btn"]').trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSignOut).toHaveBeenCalledOnce();
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

  it('shows partial-deletion message when PartialDeletionError raised', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new PartialDeletionError(['catalog']));
    const wrapper = mountView();
    await wrapper.find('[data-testid="delete-account-btn"]').trigger('click');
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Alcuni dati non sono stati rimossi');
  });
});
