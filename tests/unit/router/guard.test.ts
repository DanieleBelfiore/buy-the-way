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
import { authGuard, __resetDefaultListRedirect } from '@/router/index';
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

    it('does not remember ordinary protected routes', async () => {
      mockUseAuth.mockReturnValue({ user: ref(null), ready: ref(true) });
      await authGuard(makeRoute('lists'), makeBootRoute());
      expect(consumeReturnTo()).toBeNull();
    });

    it('sends a freshly signed-in user from /login back to the consent URL', async () => {
      saveReturnTo('/oauth/authorize?client_id=c&state=s');
      mockUseAuth.mockReturnValue({ user: authedUser(), ready: ref(true) });
      const result = await authGuard(makeRoute('login'), makeBootRoute());
      expect(result).toBe('/oauth/authorize?client_id=c&state=s');
      expect(consumeReturnTo()).toBeNull();
    });

    it('lets a signed-in user open the consent screen directly', async () => {
      mockUseAuth.mockReturnValue({ user: authedUser(), ready: ref(true) });
      expect(await authGuard(consentRoute(), makeBootRoute())).toBeUndefined();
    });
  });

  it('allows navigation to /login for unauthenticated user when ready', async () => {
    mockUseAuth.mockReturnValue({
      user: ref(null),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('login'), makeRoute('lists'));
    expect(result).toBeUndefined();
  });

  it('redirects to /login when unauthenticated and visiting protected route', async () => {
    mockUseAuth.mockReturnValue({
      user: ref(null),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('lists'), makeRoute('login'));
    expect(result).toEqual({ name: 'login' });
  });

  it('allows navigation when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: authedUser(),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('lists'), makeRoute('login'));
    expect(result).toBeUndefined();
  });

  it('redirects authenticated user away from /login to /lists', async () => {
    mockUseAuth.mockReturnValue({
      user: authedUser(),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('login'), makeRoute('lists'));
    expect(result).toEqual({ name: 'lists' });
  });

  it('redirects authenticated user away from / (home) to /lists', async () => {
    mockUseAuth.mockReturnValue({
      user: authedUser(),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('home'), makeRoute('lists'));
    expect(result).toEqual({ name: 'lists' });
  });

  it.each(['home', 'about', 'privacy', 'terms'])(
    'allows unauthenticated navigation to public route %s',
    async (name) => {
      mockUseAuth.mockReturnValue({
        user: ref(null),
        ready: ref(true),
      });
      const result = await authGuard(makeRoute(name), makeRoute('login'));
      expect(result).toBeUndefined();
    },
  );

  it.each(['about', 'privacy', 'terms'])(
    'does NOT redirect authenticated user away from public route %s',
    async (name) => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      const result = await authGuard(makeRoute(name), makeRoute('lists'));
      expect(result).toBeUndefined();
    },
  );

  describe('default-list boot redirect', () => {
    it('redirects to default list on first navigation to /lists when defaultListId set', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        cachedDefaultListId: vi.fn().mockReturnValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toEqual({ name: 'list-detail', params: { id: '01XYZ' } });
    });

    it('does not redirect on subsequent navigations (from is defined)', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        cachedDefaultListId: vi.fn().mockReturnValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeRoute('list-detail'));
      expect(result).toBeUndefined();
    });

    it('does not redirect when profile has no defaultListId', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: null },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        cachedDefaultListId: vi.fn().mockReturnValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toBeUndefined();
    });

    it('only fires once per session - second boot-shape nav does not redirect', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
        cachedDefaultListId: vi.fn().mockReturnValue(undefined),
      } as any);
      const first = await authGuard(makeRoute('lists'), makeBootRoute());
      const second = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(first).toEqual({ name: 'list-detail', params: { id: '01XYZ' } });
      expect(second).toBeUndefined();
    });

    it('falls through silently when ensureProfile rejects', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: null,
        ensureProfile: vi.fn().mockRejectedValue(new Error('network')),
        cachedDefaultListId: vi.fn().mockReturnValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toBeUndefined();
    });

    it('redirects from the cached default list without waiting for the profile', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      // Never settles: the guard must not depend on it.
      const ensureProfile = vi.fn().mockReturnValue(new Promise<void>(() => {}));
      mockUseAuthStore.mockReturnValue({
        profile: null,
        ensureProfile,
        cachedDefaultListId: vi.fn().mockReturnValue('01CACHED'),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toEqual({ name: 'list-detail', params: { id: '01CACHED' } });
      // Still refreshed in the background so the cache self-corrects.
      expect(ensureProfile).toHaveBeenCalledOnce();
    });

    it('stays on /lists without waiting when the cache says there is no default', async () => {
      mockUseAuth.mockReturnValue({
        user: authedUser(),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: null,
        ensureProfile: vi.fn().mockReturnValue(new Promise<void>(() => {})),
        cachedDefaultListId: vi.fn().mockReturnValue(null),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toBeUndefined();
    });
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
});
