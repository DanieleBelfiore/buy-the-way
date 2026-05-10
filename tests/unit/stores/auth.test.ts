import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('@/services/auth.service', () => ({
  signInWithGoogle: vi.fn().mockResolvedValue({
    uid: 'mock-uid',
    email: 'mock@example.com',
    displayName: 'Mock User',
    lastLoginAt: 0,
  }),
  signOutUser: vi.fn().mockResolvedValue(undefined),
}));

describe('stores/auth', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await useAuthStore().signOut();
  });

  it('starts unauthenticated with a null user', () => {
    const auth = useAuthStore();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.currentUser).toBeNull();
  });

  it('signIn flips isAuthenticated and populates the user', async () => {
    const auth = useAuthStore();
    await auth.signIn();
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.currentUser).not.toBeNull();
    expect(auth.currentUser?.uid).toBe('mock-uid');
    expect(auth.currentUser?.email).toBe('mock@example.com');
  });

  it('signOut clears the user and resets isAuthenticated', async () => {
    const auth = useAuthStore();
    await auth.signIn();
    await auth.signOut();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.currentUser).toBeNull();
  });

  it('isAuthenticated reflects current user reactively', async () => {
    const auth = useAuthStore();
    expect(auth.isAuthenticated).toBe(false);
    await auth.signIn();
    expect(auth.isAuthenticated).toBe(true);
    await auth.signOut();
    expect(auth.isAuthenticated).toBe(false);
  });
});
