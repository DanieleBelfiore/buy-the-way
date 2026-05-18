import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ id: 'mock-ref' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}));

import { signInWithGoogle, signOutCurrent, onAuthChanged } from '@/services/auth.service';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

const mSignInWithPopup = vi.mocked(signInWithPopup);
const mSignOut = vi.mocked(signOut);
const mOnAuthStateChanged = vi.mocked(onAuthStateChanged);
const mSetDoc = vi.mocked(setDoc);

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue({ id: 'mock-ref' } as any);
    mSetDoc.mockResolvedValue(undefined);
  });

  describe('signInWithGoogle', () => {
    it('calls signInWithPopup', async () => {
      mSignInWithPopup.mockResolvedValue({ user: { uid: 'u1' } } as any);
      await signInWithGoogle();
      expect(mSignInWithPopup).toHaveBeenCalledOnce();
    });

    it('propagates signInWithPopup errors', async () => {
      mSignInWithPopup.mockRejectedValue(new Error('auth/popup-closed-by-user'));
      await expect(signInWithGoogle()).rejects.toThrow('auth/popup-closed-by-user');
    });
  });

  describe('signOutCurrent', () => {
    it('calls signOut', async () => {
      mSignOut.mockResolvedValue(undefined);
      await signOutCurrent();
      expect(mSignOut).toHaveBeenCalledOnce();
    });
  });

  describe('onAuthChanged', () => {
    it('registers onAuthStateChanged listener', () => {
      mOnAuthStateChanged.mockReturnValue(vi.fn() as any);
      onAuthChanged(vi.fn());
      expect(mOnAuthStateChanged).toHaveBeenCalledOnce();
    });

    it('returns unsubscribe function', () => {
      const unsub = vi.fn();
      mOnAuthStateChanged.mockReturnValue(unsub as any);
      const result = onAuthChanged(vi.fn());
      expect(result).toBe(unsub);
    });

    it('calls callback with null when no user signed in', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });

      const callback = vi.fn();
      onAuthChanged(callback);

      await capturedCb!(null);

      expect(callback).toHaveBeenCalledWith(null);
      expect(mSetDoc).not.toHaveBeenCalled();
    });

    it('upserts user doc with normalized email on auth', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });

      onAuthChanged(vi.fn());

      await capturedCb!({
        uid: 'uid-1',
        email: '  TEST@Example.com  ',
        displayName: 'Test User',
      });

      expect(mSetDoc).toHaveBeenCalledOnce();
      const [, data] = mSetDoc.mock.calls[0];
      expect(data).toMatchObject({
        uid: 'uid-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      expect((data as any).lastLoginAt).toBeTypeOf('number');
    });

    it('calls callback with AuthUser when authenticated', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });

      const callback = vi.fn();
      onAuthChanged(callback);

      await capturedCb!({
        uid: 'uid-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      expect(callback).toHaveBeenCalledWith({
        uid: 'uid-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
    });

    it('handles null displayName gracefully', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });

      onAuthChanged(vi.fn());

      await capturedCb!({ uid: 'uid-2', email: 'x@y.com', displayName: null });

      const [, data] = mSetDoc.mock.calls[0];
      expect((data as any).displayName).toBe('');
    });

    it('still calls callback even when setDoc throws', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });
      mSetDoc.mockRejectedValue(new Error('firestore unavailable'));

      const callback = vi.fn();
      onAuthChanged(callback);

      await capturedCb!({ uid: 'uid-1', email: 'test@example.com', displayName: 'Test' });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-1' }));
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[auth]'),
        expect.any(Error),
      );
      consoleWarn.mockRestore();
    });

    it('handles null email gracefully', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });

      onAuthChanged(vi.fn());

      await capturedCb!({ uid: 'uid-3', email: null, displayName: 'No Email' });

      const [, data] = mSetDoc.mock.calls[0];
      expect((data as any).email).toBe('');
    });
  });
});
