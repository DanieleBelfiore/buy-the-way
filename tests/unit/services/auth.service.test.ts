import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  reauthenticateWithRedirect: vi.fn(),
  browserPopupRedirectResolver: {},
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
  onAuthChanged,
  reauthenticateGoogle,
  consumeRedirectResult,
  completeMagicLinkSignIn,
  __resetAuthLastSeenUid
} from '@/services/auth.service';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  browserPopupRedirectResolver,
  signInWithEmailLink
} from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth } from '@/services/firebase';

const mSignInWithPopup = vi.mocked(signInWithPopup);
const mSignInWithRedirect = vi.mocked(signInWithRedirect);
const mGetRedirectResult = vi.mocked(getRedirectResult);
const mReauthenticateWithPopup = vi.mocked(reauthenticateWithPopup);
const mReauthenticateWithRedirect = vi.mocked(reauthenticateWithRedirect);
const mOnAuthStateChanged = vi.mocked(onAuthStateChanged);
const mSetDoc = vi.mocked(setDoc);

/**
 * Fakes the installed-PWA display mode. `navigator.standalone` is the iOS
 * signal; `matchMedia('(display-mode: standalone)')` covers Android/desktop.
 *
 * jsdom ships no `window.matchMedia` at all, so this defines the property
 * rather than spying on it - which is also why the production helper guards
 * with a `typeof` check before calling it.
 */
const setStandalone = (on: boolean, via: 'ios' | 'mediaQuery' = 'mediaQuery'): void => {
  Object.defineProperty(window.navigator, 'standalone', {
    value: on && via === 'ios' ? true : undefined,
    configurable: true,
  });
  Object.defineProperty(window, 'matchMedia', {
    value: (q: string) =>
      ({
        matches: on && via === 'mediaQuery' && q === '(display-mode: standalone)',
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
    writable: true,
    configurable: true,
  });
};

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doc).mockReturnValue({ id: 'mock-ref' } as any);
    mSetDoc.mockResolvedValue(undefined);
    // Default every test to browser-tab mode; the standalone suites opt in.
    setStandalone(false);
    // Module-level uid tracker debounces "did the signed-in identity change?".
    // Reset between tests so each callback invocation looks like a new sign-in.
    __resetAuthLastSeenUid();
  });

  describe('signInWithGoogle', () => {
    // An installed PWA has no usable popup: on iOS standalone `window.open`
    // hands the URL to a detached Safari view with no `window.opener` back to
    // the app, so the resolver's postMessage handshake never lands and
    // signInWithPopup hangs forever on "signing in". Redirect is the only
    // flow that completes there.
    it('uses signInWithRedirect when running as an installed PWA (media query)', async () => {
      setStandalone(true, 'mediaQuery');
      mSignInWithRedirect.mockResolvedValue(undefined as never);
      await signInWithGoogle();
      expect(mSignInWithRedirect).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        browserPopupRedirectResolver,
      );
      expect(mSignInWithPopup).not.toHaveBeenCalled();
    });

    it('uses signInWithRedirect on iOS standalone (navigator.standalone)', async () => {
      setStandalone(true, 'ios');
      mSignInWithRedirect.mockResolvedValue(undefined as never);
      await signInWithGoogle();
      expect(mSignInWithRedirect).toHaveBeenCalledOnce();
      expect(mSignInWithPopup).not.toHaveBeenCalled();
    });
  });

  describe('consumeRedirectResult', () => {
    it('returns the uid when a redirect sign-in was pending', async () => {
      mGetRedirectResult.mockResolvedValue({ user: { uid: 'u9' } } as any);
      await expect(consumeRedirectResult()).resolves.toBe('u9');
      expect(mGetRedirectResult).toHaveBeenCalledWith(
        expect.anything(),
        browserPopupRedirectResolver,
      );
    });

    // Runs at boot, before the router guard resolves. A rejection here must
    // never propagate or the whole app fails to start.
    it('swallows errors so app boot is never blocked', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mGetRedirectResult.mockRejectedValue(new Error('auth/invalid-credential'));
      await expect(consumeRedirectResult()).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('reauthenticateGoogle', () => {
    afterEach(() => {
      // currentUser is set on the shared (mocked) auth object - clear it so it
      // doesn't leak into other tests in this file.
      delete (auth as { currentUser?: unknown }).currentUser;
    });

    // Same popup dead-end as sign-in: in an installed PWA the reauth popup
    // never reports back, so account deletion would hang on the confirm step.
    it('uses reauthenticateWithRedirect when running as an installed PWA', async () => {
      setStandalone(true, 'ios');
      const current = { uid: 'u1' };
      (auth as { currentUser?: unknown }).currentUser = current;
      mReauthenticateWithRedirect.mockResolvedValue(undefined as never);
      await reauthenticateGoogle();
      expect(mReauthenticateWithRedirect).toHaveBeenCalledWith(
        current,
        expect.anything(),
        browserPopupRedirectResolver,
      );
      expect(mReauthenticateWithPopup).not.toHaveBeenCalled();
    });
  });

  describe('onAuthChanged', () => {
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
      await vi.waitFor(() =>
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('[auth]'),
          expect.any(Error),
        ),
      );
      // Both writes fail in the background; let the chain drain before restore.
      await vi.waitFor(() => expect(mSetDoc).toHaveBeenCalledTimes(2));
      await Promise.resolve();
      consoleWarn.mockRestore();
    });

    it('restored session: calls callback without waiting for the profile writes', async () => {
      let capturedCb: ((u: any) => Promise<void>) | undefined;
      mOnAuthStateChanged.mockImplementation((_auth, cb) => {
        capturedCb = cb as any;
        return vi.fn() as any;
      });
      // Never settles: simulates a slow / offline Firestore.
      mSetDoc.mockReturnValue(new Promise<void>(() => {}));

      const callback = vi.fn();
      onAuthChanged(callback);

      // First event of the page load already carries a user = persisted session.
      await capturedCb!({ uid: 'uid-1', email: 'test@example.com', displayName: 'Test' });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-1' }));
      expect(mSetDoc).toHaveBeenCalledTimes(1);
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
    });
  });
});
