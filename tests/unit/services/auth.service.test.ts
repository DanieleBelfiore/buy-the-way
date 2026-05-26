import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendSignInLinkToEmail: vi.fn().mockResolvedValue(undefined),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
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
  sendMagicLink,
  completeMagicLinkSignIn,
  isMagicLinkCallback,
  __resetAuthLastSeenUid,
} from '@/services/auth.service';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
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
      // Public payload must NOT carry lastLoginAt - that's PII now.
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

  describe('magic link (S2.3)', () => {
    beforeEach(() => {
      // jsdom provides a real localStorage; clear between tests so the
      // stored-email state doesn't leak.
      try { window.localStorage.clear(); } catch { /* ignored */ }
      // Origin defaults to about:blank in some setups; force a known one
      // so the continueUrl assertions are deterministic.
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          origin: 'https://app.test',
          href: 'https://app.test/auth/email-link-callback?oobCode=abc',
        },
      });
    });

    describe('sendMagicLink', () => {
      it('calls sendSignInLinkToEmail with normalized email and the continueUrl', async () => {
        await sendMagicLink('  USER@example.COM  ');
        expect(sendSignInLinkToEmail).toHaveBeenCalledOnce();
        const [, email, settings] = vi.mocked(sendSignInLinkToEmail).mock.calls[0]!;
        expect(email).toBe('user@example.com');
        expect(settings).toMatchObject({
          url: 'https://app.test/auth/email-link-callback',
          handleCodeInApp: true,
        });
      });

      it('persists the requesting email in localStorage so the callback page can use it', async () => {
        await sendMagicLink('user@example.com');
        expect(window.localStorage.getItem('btw:magicLinkEmail')).toBe('user@example.com');
      });

      it('throws on empty input', async () => {
        await expect(sendMagicLink('   ')).rejects.toThrow(/empty email/);
      });
    });

    describe('completeMagicLinkSignIn', () => {
      it('reads the stored email and completes sign-in', async () => {
        window.localStorage.setItem('btw:magicLinkEmail', 'user@example.com');
        vi.mocked(signInWithEmailLink).mockResolvedValue({ user: { uid: 'uid-7' } } as any);

        const uid = await completeMagicLinkSignIn('https://app.test/auth/email-link-callback?oobCode=abc');

        expect(uid).toBe('uid-7');
        const [, email, link] = vi.mocked(signInWithEmailLink).mock.calls[0]!;
        expect(email).toBe('user@example.com');
        expect(link).toBe('https://app.test/auth/email-link-callback?oobCode=abc');
        // Stored email is cleared after successful sign-in.
        expect(window.localStorage.getItem('btw:magicLinkEmail')).toBeNull();
      });

      it('accepts an explicit emailHint when localStorage is empty', async () => {
        vi.mocked(signInWithEmailLink).mockResolvedValue({ user: { uid: 'uid-9' } } as any);
        const uid = await completeMagicLinkSignIn(
          'https://app.test/auth/email-link-callback?oobCode=abc',
          'cross-device@example.com',
        );
        expect(uid).toBe('uid-9');
        const [, email] = vi.mocked(signInWithEmailLink).mock.calls[0]!;
        expect(email).toBe('cross-device@example.com');
      });

      it('throws when no email is stored and no hint is provided', async () => {
        await expect(
          completeMagicLinkSignIn('https://app.test/auth/email-link-callback?oobCode=abc'),
        ).rejects.toThrow(/missing email/);
      });
    });

    describe('isMagicLinkCallback', () => {
      it('delegates to the Firebase Auth helper', () => {
        vi.mocked(isSignInWithEmailLink).mockReturnValue(true);
        expect(isMagicLinkCallback('https://app.test/auth/email-link-callback?oobCode=abc')).toBe(true);
        expect(isSignInWithEmailLink).toHaveBeenCalledWith(
          expect.anything(),
          'https://app.test/auth/email-link-callback?oobCode=abc',
        );
      });
    });
  });
});
