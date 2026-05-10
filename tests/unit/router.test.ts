import { describe, expect, it, vi } from 'vitest';
import { redirectTarget } from '@/router';

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
  }),
}));

describe('router auth guard (redirectTarget)', () => {
  it('redirects unauthenticated traffic on / to /login', () => {
    expect(redirectTarget(false, '/')).toBe('/login');
  });

  it('allows authenticated traffic on /', () => {
    expect(redirectTarget(true, '/')).toBe(true);
  });

  it('allows /login when unauthenticated (public route)', () => {
    expect(redirectTarget(false, '/login')).toBe(true);
  });

  it('redirects unauthenticated traffic on nested protected routes', () => {
    expect(redirectTarget(false, '/lists/01HABCDEF/settings')).toBe('/login');
    expect(redirectTarget(false, '/trash')).toBe('/login');
    expect(redirectTarget(false, '/settings')).toBe('/login');
  });

  it('allows authenticated traffic on protected routes', () => {
    expect(redirectTarget(true, '/lists/01HABCDEF')).toBe(true);
    expect(redirectTarget(true, '/lists/01HABCDEF/collaborators/add')).toBe(true);
  });
});

