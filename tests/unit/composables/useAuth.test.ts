import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Use real auth store — mock only the service it depends on
import { vi } from 'vitest';
vi.mock('@/services/auth.service', () => ({
  signInWithGoogle: vi.fn(),
  signOutCurrent: vi.fn(),
  onAuthChanged: vi.fn(),
}));

import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('returns user null and ready false on fresh store', () => {
    const { user, ready } = useAuth();
    expect(user.value).toBeNull();
    expect(ready.value).toBe(false);
  });

  it('reflects store user state reactively', () => {
    const store = useAuthStore();
    const { user } = useAuth();

    store.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' };

    expect(user.value).toEqual({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
  });

  it('reflects store ready state reactively', () => {
    const store = useAuthStore();
    const { ready } = useAuth();

    store.ready = true;

    expect(ready.value).toBe(true);
  });
});
