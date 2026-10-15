import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/auth.service', () => ({
  signInWithGoogle: vi.fn(),
  signOutCurrent: vi.fn(),
  onAuthChanged: vi.fn(),
  deleteAccount: vi.fn(),
  reauthenticateGoogle: vi.fn(),
  sendMagicLink: vi.fn(),
  completeMagicLinkSignIn: vi.fn(),
  isMagicLinkCallback: vi.fn(),
}));

vi.mock('@/services/users.service', () => ({
  getUserProfile: vi.fn(),
  setUserDefaultList: vi.fn(),
  setOnboardingSeen: vi.fn().mockResolvedValue(undefined),
}));

import { useAuthStore } from '@/stores/auth';
import { onAuthChanged } from '@/services/auth.service';
import { getUserProfile, setUserDefaultList } from '@/services/users.service';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('sets user and ready=true when auth fires with user', () => {
    let capturedCb: ((u: any) => void) | undefined;
    vi.mocked(onAuthChanged).mockImplementation((cb) => {
      capturedCb = cb;
      return vi.fn();
    });

    const store = useAuthStore();
    store.init();
    capturedCb!({ uid: 'u1', email: 'a@b.com', displayName: 'A' });

    expect(store.user).toEqual({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    expect(store.ready).toBe(true);
  });

  it('sets user to null and ready=true when signed out', () => {
    let capturedCb: ((u: any) => void) | undefined;
    vi.mocked(onAuthChanged).mockImplementation((cb) => {
      capturedCb = cb;
      return vi.fn();
    });

    const store = useAuthStore();
    store.init();
    capturedCb!(null);

    expect(store.user).toBeNull();
    expect(store.ready).toBe(true);
  });

  describe('ensureProfile', () => {
    const signIn = (cb: (u: any) => void, user: any) => cb(user);

    it('coalesces concurrent calls into a single fetch (single-flight)', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'u1', email: 'a@b.com', displayName: 'A', lastLoginAt: 0,
      });

      const store = useAuthStore();
      store.init();
      signIn(capturedCb!, { uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await Promise.all([store.ensureProfile(), store.ensureProfile(), store.ensureProfile()]);
      expect(getUserProfile).toHaveBeenCalledOnce();
    });

    it('clears cached profile when the auth user changes', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'u1', email: 'a@b.com', displayName: 'A', lastLoginAt: 0,
      });

      const store = useAuthStore();
      store.init();
      signIn(capturedCb!, { uid: 'u1', email: 'a@b.com', displayName: 'A' });
      await store.ensureProfile();
      expect(store.profile?.uid).toBe('u1');

      // Sign out → profile should clear.
      signIn(capturedCb!, null);
      expect(store.profile).toBeNull();
    });
  });

  describe('cachedDefaultListId', () => {
    const boot = (uid = 'u1') => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      const store = useAuthStore();
      store.init();
      capturedCb!({ uid, email: 'a@b.com', displayName: 'A' });
      return store;
    };

    beforeEach(() => {
      localStorage.clear();
    });

    it('remembers the default list once the profile has loaded', async () => {
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'u1', email: 'a@b.com', displayName: 'A', lastLoginAt: 0, defaultListId: '01XYZ',
      });
      const store = boot();
      await store.ensureProfile();
      expect(store.cachedDefaultListId()).toBe('01XYZ');
    });

    it('follows setDefaultListId, including clearing', async () => {
      vi.mocked(setUserDefaultList).mockResolvedValue(undefined);
      const store = boot();
      await store.setDefaultListId('01NEW');
      expect(store.cachedDefaultListId()).toBe('01NEW');
      await store.setDefaultListId(null);
      expect(store.cachedDefaultListId()).toBeNull();
    });

    it('is scoped per user', async () => {
      vi.mocked(setUserDefaultList).mockResolvedValue(undefined);
      const first = boot('u1');
      await first.setDefaultListId('01XYZ');
      setActivePinia(createPinia());
      const second = boot('u2');
      expect(second.cachedDefaultListId()).toBeUndefined();
    });
  });
});
