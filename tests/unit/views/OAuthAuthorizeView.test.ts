import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';

const { callOAuthAuthorize, navigateToClient } = vi.hoisted(() => ({
  callOAuthAuthorize: vi.fn(),
  navigateToClient: vi.fn(),
}));

vi.mock('@/services/oauth.service', async (orig) => ({
  ...(await orig<typeof import('@/services/oauth.service')>()),
  callOAuthAuthorize,
  navigateToClient,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { uid: 'me', email: 'me@example.com', displayName: null } }),
}));

import OAuthAuthorizeView from '@/views/OAuthAuthorizeView.vue';
import en from '@/i18n/locales/en.json';

const QUERY = '?response_type=code&client_id=mcp_abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&code_challenge=x&code_challenge_method=S256&state=s1&junk=1';

const mountView = async (query = QUERY) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/oauth/authorize', name: 'oauth-authorize', component: OAuthAuthorizeView },
      { path: '/lists', name: 'lists', component: { template: '<div />' } },
    ],
  });
  await router.push(`/oauth/authorize${query}`);
  await router.isReady();
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });
  const wrapper = mount(OAuthAuthorizeView, { global: { plugins: [i18n, router] } });
  await flushPromises();
  return { wrapper, router };
};

const EXPECTED_PARAMS = {
  response_type: 'code',
  client_id: 'mcp_abc',
  redirect_uri: 'https://claude.ai/cb',
  code_challenge: 'x',
  code_challenge_method: 'S256',
  state: 's1',
};

describe('OAuthAuthorizeView (MCP consent screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOAuthAuthorize.mockResolvedValue({ status: 'ok', clientName: 'Claude', redirectHost: 'claude.ai' });
  });

  it('describes the request on mount, forwarding only the OAuth params', async () => {
    const { wrapper } = await mountView();
    expect(callOAuthAuthorize).toHaveBeenCalledWith('describe', EXPECTED_PARAMS);
    const text = wrapper.text();
    expect(text).toContain('Connect Claude to Buy The Way');
    expect(text).toContain('claude.ai');
    expect(text).toContain('me@example.com');
    expect(text).toContain('Delete lists, manage collaborators or see photos');
  });

  it('names the redirect host up front, since the client name is not verified', async () => {
    const remote = (await mountView()).wrapper.get('[data-testid="oauth-redirect-warning"]').text();
    expect(remote).toContain('you will go to claude.ai');
    expect(remote).toContain('“Claude” is chosen by the app and is not verified');

    callOAuthAuthorize.mockResolvedValueOnce({ status: 'ok', clientName: 'Claude Code', redirectHost: 'localhost:33418' });
    const local = (await mountView()).wrapper.get('[data-testid="oauth-redirect-warning"]').text();
    expect(local).toContain('an app on this device (localhost:33418)');
  });

  it('approve sends the user back to the client with the code', async () => {
    const { wrapper } = await mountView();
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'redirect', redirectTo: 'https://claude.ai/cb?code=c&state=s1' });
    await wrapper.get('[data-testid="oauth-allow"]').trigger('click');
    await flushPromises();
    expect(callOAuthAuthorize).toHaveBeenLastCalledWith('approve', EXPECTED_PARAMS);
    expect(navigateToClient).toHaveBeenCalledWith('https://claude.ai/cb?code=c&state=s1');
  });

  it('deny sends the user back with the error redirect', async () => {
    const { wrapper } = await mountView();
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'redirect', redirectTo: 'https://claude.ai/cb?error=access_denied' });
    await wrapper.get('[data-testid="oauth-deny"]').trigger('click');
    await flushPromises();
    expect(callOAuthAuthorize).toHaveBeenLastCalledWith('deny', EXPECTED_PARAMS);
    expect(navigateToClient).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied');
  });

  it('disables both buttons while a decision is in flight', async () => {
    const { wrapper } = await mountView();
    callOAuthAuthorize.mockReturnValueOnce(new Promise(() => {}));
    await wrapper.get('[data-testid="oauth-allow"]').trigger('click');
    expect(wrapper.get('[data-testid="oauth-allow"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="oauth-deny"]').attributes('disabled')).toBeDefined();
  });

  it('never leaves the app on load, even if describe answers with a redirect', async () => {
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'redirect', redirectTo: 'https://evil.example/' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = await mountView();
    expect(navigateToClient).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true);
  });

  it('shows the private-beta notice with a way back to the client', async () => {
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'unavailable', redirectTo: 'https://claude.ai/cb?error=access_denied' });
    const { wrapper } = await mountView();
    expect(wrapper.text()).toContain('Access through AI assistants is not available for your account yet.');
    expect(wrapper.find('[data-testid="oauth-allow"]').exists()).toBe(false);
    await wrapper.get('[data-testid="oauth-back"]').trigger('click');
    expect(navigateToClient).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied');
  });

  it('shows the unavailable notice when the gate closes between describe and approve', async () => {
    const { wrapper } = await mountView();
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'unavailable', redirectTo: 'https://claude.ai/cb?error=access_denied' });
    await wrapper.get('[data-testid="oauth-allow"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="oauth-unavailable"]').exists()).toBe(true);
    expect(navigateToClient).not.toHaveBeenCalled();
  });

  it('reports an invalid request on the page and never redirects', async () => {
    callOAuthAuthorize.mockResolvedValueOnce({ status: 'invalid', reason: 'redirect_uri_mismatch' });
    const { wrapper, router } = await mountView();
    expect(wrapper.find('[data-testid="oauth-invalid"]').exists()).toBe(true);
    expect(navigateToClient).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="oauth-go-lists"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('lists');
  });

  it('shows an error with retry when the call fails', async () => {
    callOAuthAuthorize.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper } = await mountView();
    expect(wrapper.find('[data-testid="oauth-error"]').exists()).toBe(true);
    await wrapper.get('[data-testid="oauth-retry"]').trigger('click');
    await flushPromises();
    expect(callOAuthAuthorize).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Connect Claude to Buy The Way');
  });
});
