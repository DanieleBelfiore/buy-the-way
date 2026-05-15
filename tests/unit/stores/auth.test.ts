import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/auth.service', () => ({
  signInWithGoogle: vi.fn(),
  signOutCurrent: vi.fn(),
  onAuthChanged: vi.fn(),
}));

import { useAuthStore } from '@/stores/auth';
import { signInWithGoogle, signOutCurrent, onAuthChanged } from '@/services/auth.service';

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
});
