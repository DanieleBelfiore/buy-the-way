import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';

vi.mock('@/composables/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuth, type AuthUser } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import router, { authGuard, __resetDefaultListRedirect } from '@/router/index';
import { saveReturnTo, consumeReturnTo } from '@/domain/returnTo';
import type { RouteLocationNormalized } from 'vue-router';

const mockUseAuth = vi.mocked(useAuth);
const mockUseAuthStore = vi.mocked(useAuthStore);

const authedUser = (): Ref<AuthUser | null> =>
  ref<AuthUser | null>({ uid: 'user-1', email: 'a@b.com', displayName: null });

const makeRoute = (name?: string): RouteLocationNormalized =>
  ({ name, meta: {}, fullPath: name ? `/${name}` : '/' }) as unknown as RouteLocationNormalized;

const makeBootRoute = (): RouteLocationNormalized =>
  ({ name: undefined, meta: {}, fullPath: '/' }) as unknown as RouteLocationNormalized;

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetDefaultListRedirect();
    // Default: auth store with no profile (so most tests don't trigger redirect).
    mockUseAuthStore.mockReturnValue({
      profile: null,
      ensureProfile: vi.fn().mockResolvedValue(undefined),
      cachedDefaultListId: vi.fn().mockReturnValue(undefined),
    } as any);
  });

  describe('return after login (MCP consent screen)', () => {
    const consentRoute = (): RouteLocationNormalized =>
      ({ name: 'oauth-authorize', meta: {}, fullPath: '/oauth/authorize?client_id=c&state=s' }) as unknown as RouteLocationNormalized;

    beforeEach(() => {
      localStorage.clear();
    });

    it('remembers the consent URL before sending an anonymous user to /login', async () => {
      mockUseAuth.mockReturnValue({ user: ref(null), ready: ref(true) });
      const result = await authGuard(consentRoute(), makeBootRoute());
      expect(result).toEqual({ name: 'login' });
      expect(consumeReturnTo()).toBe('/oauth/authorize?client_id=c&state=s');
    });

    it('sends a freshly signed-in user from /login back to the consent URL', async () => {
      saveReturnTo('/oauth/authorize?client_id=c&state=s');
      mockUseAuth.mockReturnValue({ user: authedUser(), ready: ref(true) });
      const result = await authGuard(makeRoute('login'), makeBootRoute());
      expect(result).toBe('/oauth/authorize?client_id=c&state=s');
      expect(consumeReturnTo()).toBeNull();
    });
  });

  it('redirects to /login when unauthenticated and visiting protected route', async () => {
    mockUseAuth.mockReturnValue({
      user: ref(null),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('lists'), makeRoute('login'));
    expect(result).toEqual({ name: 'login' });
  });

  it('redirects authenticated user away from /login to /lists', async () => {
    mockUseAuth.mockReturnValue({
      user: authedUser(),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('login'), makeRoute('lists'));
    expect(result).toEqual({ name: 'lists' });
  });

  it('waits for ready before deciding when auth not ready', async () => {
    const readyRef = ref(false);
    mockUseAuth.mockReturnValue({
      user: ref(null),
      ready: readyRef,
    });
    const guardPromise = authGuard(makeRoute('lists'), makeRoute('login'));
    readyRef.value = true;
    const result = await guardPromise;
    expect(result).toEqual({ name: 'login' });
  });

  describe('unknown URLs', () => {
    it('resolve to the public 404 page instead of shadowing real routes', () => {
      expect(router.resolve('/no/such/page').name).toBe('not-found');
      expect(router.resolve('/lists/abc').name).toBe('list-detail');
      expect(router.resolve('/oauth/authorize').name).toBe('oauth-authorize');
    });

    it('lets an anonymous visitor see the 404 rather than bouncing to /login', async () => {
      mockUseAuth.mockReturnValue({ user: ref(null), ready: ref(true) });
      expect(await authGuard(makeRoute('not-found'), makeBootRoute())).toBeUndefined();
      expect(await authGuard(makeRoute('lists'), makeBootRoute())).toEqual({ name: 'login' });
    });
  });
});
