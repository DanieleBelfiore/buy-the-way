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
  signOutCurrent,
  onAuthChanged,
  reauthenticateGoogle,
  consumeRedirectResult,
  isStandaloneDisplay,
  NoCurrentUserError,
  sendMagicLink,
  completeMagicLinkSignIn,
  isMagicLinkCallback,
  __resetAuthLastSeenUid,
} from '@/services/auth.service';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  browserPopupRedirectResolver,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth } from '@/services/firebase';

const mSignInWithPopup = vi.mocked(signInWithPopup);
const mSignInWithRedirect = vi.mocked(signInWithRedirect);
const mGetRedirectResult = vi.mocked(getRedirectResult);
const mReauthenticateWithPopup = vi.mocked(reauthenticateWithPopup);
const mReauthenticateWithRedirect = vi.mocked(reauthenticateWithRedirect);
const mSignOut = vi.mocked(signOut);
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
    it('calls signInWithPopup', async () => {
      mSignInWithPopup.mockResolvedValue({ user: { uid: 'u1' } } as any);
      await signInWithGoogle();
      expect(mSignInWithPopup).toHaveBeenCalledOnce();
    });

    // Auth is initialized via initializeAuth() WITHOUT a default
    // popupRedirectResolver (so the gapi iframe stays off the LCP critical
    // path at boot). The resolver must therefore be passed explicitly here,
    // or signInWithPopup throws auth/argument-error at runtime - which the
    // mocked SDK would not surface. Lock the invariant.
    it('passes the explicit popup-redirect resolver', async () => {
      mSignInWithPopup.mockResolvedValue({ user: { uid: 'u1' } } as any);
      await signInWithGoogle();
      expect(mSignInWithPopup).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        browserPopupRedirectResolver,
      );
    });

    it('propagates signInWithPopup errors', async () => {
      mSignInWithPopup.mockRejectedValue(new Error('auth/popup-closed-by-user'));
      await expect(signInWithGoogle()).rejects.toThrow('auth/popup-closed-by-user');
    });

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

  describe('isStandaloneDisplay', () => {
    it('is false in a browser tab', () => {
      setStandalone(false);
      expect(isStandaloneDisplay()).toBe(false);
    });

    it('tolerates a missing matchMedia implementation', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isStandaloneDisplay()).toBe(false);
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

    it('returns null when there was no pending redirect', async () => {
      mGetRedirectResult.mockResolvedValue(null as any);
      await expect(consumeRedirectResult()).resolves.toBeNull();
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

    it('throws NoCurrentUserError when no user is signed in', async () => {
      delete (auth as { currentUser?: unknown }).currentUser;
      await expect(reauthenticateGoogle()).rejects.toThrow(NoCurrentUserError);
      expect(mReauthenticateWithPopup).not.toHaveBeenCalled();
    });

    it('passes the explicit popup-redirect resolver', async () => {
      const current = { uid: 'u1' };
      (auth as { currentUser?: unknown }).currentUser = current;
      mReauthenticateWithPopup.mockResolvedValue({ user: current } as any);
      await reauthenticateGoogle();
      expect(mReauthenticateWithPopup).toHaveBeenCalledWith(
        current,
        expect.anything(),
        browserPopupRedirectResolver,
      );
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
      beforeEach(() => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
        );
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('POSTs to send-magic-link with normalized email, locale, and continueOrigin', async () => {
        await sendMagicLink('  USER@example.COM  ', 'it');
        expect(fetch).toHaveBeenCalledOnce();
        const [url, init] = vi.mocked(fetch).mock.calls[0]!;
        expect(url).toBe('/.netlify/functions/send-magic-link');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({
          email: 'user@example.com',
          locale: 'it',
          continueOrigin: 'https://app.test',
        });
      });

      it('persists the requesting email in localStorage so the callback page can use it', async () => {
        await sendMagicLink('user@example.com');
        expect(window.localStorage.getItem('btw:magicLinkEmail')).toBe('user@example.com');
      });

      it('throws on empty input', async () => {
        await expect(sendMagicLink('   ')).rejects.toThrow(/empty email/);
      });

      it('throws MagicLinkEmailError when the function rejects', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }),
        );
        await expect(sendMagicLink('user@example.com')).rejects.toMatchObject({
          name: 'MagicLinkEmailError',
          code: 'rate_limited',
          status: 429,
        });
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
