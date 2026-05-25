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
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn().mockReturnValue({ __op: 'deleteField' }),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}));

// Stub users.service so the migration helper called by onAuthChanged is a
// no-op in this test surface (the migration is exercised in its own suite).
vi.mock('@/services/users.service', () => ({
  migrateLegacyPrivateFields: vi.fn().mockResolvedValue([]),
  deletePrivateState: vi.fn().mockResolvedValue(undefined),
}));

import {
  signInWithGoogle,
  signOutCurrent,
  onAuthChanged,
  __resetAuthLastSeenUid,
} from '@/services/auth.service';
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
    // Module-level uid tracker debounces "did the signed-in identity change?".
    // Reset between tests so each callback invocation looks like a new sign-in.
    __resetAuthLastSeenUid();
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

    it('upserts public profile (top-level) with normalized email AND lastLoginAt in private subcollection', async () => {
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

      // Two writes: public top-level + private subcollection.
      expect(mSetDoc).toHaveBeenCalledTimes(2);

      const publicPayloads = mSetDoc.mock.calls
        .map((c) => c[1] as Record<string, unknown>)
        .filter((p) => 'email' in p);
      expect(publicPayloads.length).toBeGreaterThan(0);
      expect(publicPayloads[0]).toMatchObject({
        uid: 'uid-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      // Public payload must NOT carry lastLoginAt — that's PII now.
      expect((publicPayloads[0] as any).lastLoginAt).toBeUndefined();

      const privatePayloads = mSetDoc.mock.calls
        .map((c) => c[1] as Record<string, unknown>)
        .filter((p) => 'lastLoginAt' in p);
      expect(privatePayloads.length).toBe(1);
      expect((privatePayloads[0] as any).lastLoginAt).toBeTypeOf('number');
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

      // Find the public-profile call (the one carrying `email`).
      const pub = mSetDoc.mock.calls
        .map((c) => c[1] as Record<string, unknown>)
        .find((p) => 'email' in p);
      expect((pub as any)?.displayName).toBe('');
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

      const pub = mSetDoc.mock.calls
        .map((c) => c[1] as Record<string, unknown>)
        .find((p) => 'email' in p);
      expect((pub as any)?.email).toBe('');
    });
  });
});
