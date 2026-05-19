import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

vi.mock('@/composables/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/composables/useAuth';
import { authGuard } from '@/router/index';
import type { RouteLocationNormalized } from 'vue-router';

const mockUseAuth = vi.mocked(useAuth);

const makeRoute = (name: string): RouteLocationNormalized =>
  ({ name, meta: {}, fullPath: `/${name}` }) as unknown as RouteLocationNormalized;

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it.each(['about', 'privacy', 'terms'])(
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
