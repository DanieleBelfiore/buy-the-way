import { describe, expect, it } from 'vitest';
import { redirectTarget } from '@/router';
import { useAuth } from '@/composables/useAuth';

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

describe('useAuth singleton state', () => {
  it('flips isAuthenticated and populates user on signIn / clears on signOut', () => {
    const auth = useAuth();
    auth.signOut();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.user.value).toBeNull();

    auth.signIn();
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value).not.toBeNull();
    expect(auth.user.value?.uid).toBe('mock-uid');
    expect(auth.user.value?.email).toBe('mock@example.com');

    auth.signOut();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.user.value).toBeNull();
  });

  it('shares state across separate useAuth() calls (module-scope singleton)', () => {
    const a = useAuth();
    const b = useAuth();
    a.signOut();
    expect(b.isAuthenticated.value).toBe(false);
    a.signIn();
    expect(b.isAuthenticated.value).toBe(true);
    a.signOut();
  });
});
