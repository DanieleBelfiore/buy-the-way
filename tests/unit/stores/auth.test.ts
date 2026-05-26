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
import {
  signInWithGoogle,
  signOutCurrent,
  onAuthChanged,
  deleteAccount as deleteAccountSvc,
  reauthenticateGoogle,
} from '@/services/auth.service';
import { getUserProfile, setUserDefaultList } from '@/services/users.service';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('starts with user null and ready false', () => {
    const store = useAuthStore();
    expect(store.user).toBeNull();
    expect(store.ready).toBe(false);
  });

  it('init calls onAuthChanged', () => {
    vi.mocked(onAuthChanged).mockReturnValue(vi.fn());
    const store = useAuthStore();
    store.init();
    expect(onAuthChanged).toHaveBeenCalledOnce();
  });

  it('init returns unsubscribe from onAuthChanged', () => {
    const unsub = vi.fn();
    vi.mocked(onAuthChanged).mockReturnValue(unsub);
    const store = useAuthStore();
    const result = store.init();
    expect(result).toBe(unsub);
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

  it('signIn delegates to signInWithGoogle', async () => {
    vi.mocked(signInWithGoogle).mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.signIn();
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });

  it('signOut delegates to signOutCurrent', async () => {
    vi.mocked(signOutCurrent).mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.signOut();
    expect(signOutCurrent).toHaveBeenCalledOnce();
  });

  it('deleteAccount delegates to service with uid', async () => {
    vi.mocked(deleteAccountSvc).mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.deleteAccount('uid-1');
    expect(deleteAccountSvc).toHaveBeenCalledWith('uid-1');
  });

  it('reauthenticate delegates to reauthenticateGoogle', async () => {
    vi.mocked(reauthenticateGoogle).mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.reauthenticate();
    expect(reauthenticateGoogle).toHaveBeenCalledOnce();
  });

  describe('ensureProfile', () => {
    const signIn = (cb: (u: any) => void, user: any) => cb(user);

    it('no-ops when user is null', async () => {
      const store = useAuthStore();
      await store.ensureProfile();
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    it('loads profile from getUserProfile and stores it', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'u1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
        defaultListId: '01XYZ',
      });

      const store = useAuthStore();
      store.init();
      signIn(capturedCb!, { uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await store.ensureProfile();
      expect(getUserProfile).toHaveBeenCalledWith('u1');
      expect(store.profile?.defaultListId).toBe('01XYZ');
    });

    it('returns cached profile without re-fetching on second call', async () => {
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
      await store.ensureProfile();
      expect(getUserProfile).toHaveBeenCalledOnce();
    });

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

    it('swallows getUserProfile errors without throwing', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(getUserProfile).mockRejectedValue(new Error('network'));

      const store = useAuthStore();
      store.init();
      signIn(capturedCb!, { uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await expect(store.ensureProfile()).resolves.toBeUndefined();
      expect(store.profile).toBeNull();
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

  describe('setDefaultListId', () => {
    it('no-ops when user is null', async () => {
      const store = useAuthStore();
      await store.setDefaultListId('01XYZ');
      expect(setUserDefaultList).not.toHaveBeenCalled();
    });

    it('calls setUserDefaultList with uid and listId', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(setUserDefaultList).mockResolvedValue(undefined);

      const store = useAuthStore();
      store.init();
      capturedCb!({ uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await store.setDefaultListId('01XYZ');
      expect(setUserDefaultList).toHaveBeenCalledWith('u1', '01XYZ');
    });

    it('accepts null to clear the default', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(setUserDefaultList).mockResolvedValue(undefined);

      const store = useAuthStore();
      store.init();
      capturedCb!({ uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await store.setDefaultListId(null);
      expect(setUserDefaultList).toHaveBeenCalledWith('u1', null);
    });

    it('updates the cached profile.defaultListId after a successful write', async () => {
      let capturedCb: ((u: any) => void) | undefined;
      vi.mocked(onAuthChanged).mockImplementation((cb) => {
        capturedCb = cb;
        return vi.fn();
      });
      vi.mocked(getUserProfile).mockResolvedValue({
        uid: 'u1', email: 'a@b.com', displayName: 'A', lastLoginAt: 0, defaultListId: null,
      });
      vi.mocked(setUserDefaultList).mockResolvedValue(undefined);

      const store = useAuthStore();
      store.init();
      capturedCb!({ uid: 'u1', email: 'a@b.com', displayName: 'A' });

      await store.ensureProfile();
      await store.setDefaultListId('01XYZ');
      expect(store.profile?.defaultListId).toBe('01XYZ');
    });
  });

});
