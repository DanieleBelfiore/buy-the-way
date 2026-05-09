import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

describe('stores/auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.signOut();
  });

  it('starts unauthenticated with a null user', () => {
    const auth = useAuthStore();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.currentUser).toBeNull();
  });

  it('signIn flips isAuthenticated and populates the user', () => {
    const auth = useAuthStore();
    auth.signIn();
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.currentUser).not.toBeNull();
    expect(auth.currentUser?.uid).toBe('mock-uid');
    expect(auth.currentUser?.email).toBe('mock@example.com');
  });

  it('signOut clears the user and resets isAuthenticated', () => {
    const auth = useAuthStore();
    auth.signIn();
    auth.signOut();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.currentUser).toBeNull();
  });

  it('isAuthenticated reflects current user reactively', () => {
    const auth = useAuthStore();
    expect(auth.isAuthenticated).toBe(false);
    auth.signIn();
    expect(auth.isAuthenticated).toBe(true);
    auth.signOut();
    expect(auth.isAuthenticated).toBe(false);
  });
});
