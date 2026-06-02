import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

vi.mock('@/composables/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import { authGuard, __resetDefaultListRedirect } from '@/router/index';
import type { RouteLocationNormalized } from 'vue-router';

const mockUseAuth = vi.mocked(useAuth);
const mockUseAuthStore = vi.mocked(useAuthStore);

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
    } as any);
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
      user: ref({ uid: 'user-1', email: 'a@b.com' }),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('lists'), makeRoute('login'));
    expect(result).toBeUndefined();
  });

  it('redirects authenticated user away from /login to /lists', async () => {
    mockUseAuth.mockReturnValue({
      user: ref({ uid: 'user-1', email: 'a@b.com' }),
      ready: ref(true),
    });
    const result = await authGuard(makeRoute('login'), makeRoute('lists'));
    expect(result).toEqual({ name: 'lists' });
  });

  it('redirects authenticated user away from / (home) to /lists', async () => {
    mockUseAuth.mockReturnValue({
      user: ref({ uid: 'user-1', email: 'a@b.com' }),
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
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      const result = await authGuard(makeRoute(name), makeRoute('lists'));
      expect(result).toBeUndefined();
    },
  );

  describe('default-list boot redirect', () => {
    it('redirects to default list on first navigation to /lists when defaultListId set', async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toEqual({ name: 'list-detail', params: { id: '01XYZ' } });
    });

    it('does not redirect on subsequent navigations (from is defined)', async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeRoute('list-detail'));
      expect(result).toBeUndefined();
    });

    it('does not redirect when profile has no defaultListId', async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: null },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
      } as any);
      const result = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(result).toBeUndefined();
    });

    it('only fires once per session - second boot-shape nav does not redirect', async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: { uid: 'user-1', defaultListId: '01XYZ' },
        ensureProfile: vi.fn().mockResolvedValue(undefined),
      } as any);
      const first = await authGuard(makeRoute('lists'), makeBootRoute());
      const second = await authGuard(makeRoute('lists'), makeBootRoute());
      expect(first).toEqual({ name: 'list-detail', params: { id: '01XYZ' } });
      expect(second).toBeUndefined();
    });

    it('falls through silently when ensureProfile rejects', async () => {
      mockUseAuth.mockReturnValue({
        user: ref({ uid: 'user-1', email: 'a@b.com' }),
        ready: ref(true),
      });
      mockUseAuthStore.mockReturnValue({
        profile: null,
        ensureProfile: vi.fn().mockRejectedValue(new Error('network')),
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
