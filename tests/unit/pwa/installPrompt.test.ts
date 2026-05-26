import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupInstallPrompt,
  useInstallPrompt,
  __resetInstallPromptForTests,
} from '@/pwa/installPrompt';

const makeBeforeInstallPromptEvent = (
  outcome: 'accepted' | 'dismissed' = 'accepted',
): Event => {
  const e = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return e;
};

const setUserAgent = (ua: string): void => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
};

const setStandalone = (standalone: boolean): void => {
  const mql = {
    matches: standalone,
    media: '(display-mode: standalone)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockReturnValue(mql),
    configurable: true,
    writable: true,
  });
};

const setMobileUserAgent = (): void => {
  setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit Chrome/120 Mobile Safari');
};

describe('installPrompt', () => {
  beforeEach(() => {
    __resetInstallPromptForTests();
    // Default to a mobile UA - the install prompt is mobile-only, so every
    // existing assertion that expects flags to flip needs a mobile context.
    setMobileUserAgent();
    setStandalone(false);
    // Reset iOS standalone flag if set previously.
    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });
  });

  it('initial state: nothing flagged', () => {
    const state = useInstallPrompt();
    expect(state.canInstall.value).toBe(false);
    expect(state.isInstalled.value).toBe(false);
    expect(state.showIOSHint.value).toBe(false);
    expect(state.isMobile.value).toBe(false);
    expect(state.dismissed.value).toBe(false);
  });

  it('flags isMobile=true for a mobile UA', () => {
    const state = setupInstallPrompt();
    expect(state.isMobile.value).toBe(true);
  });

  it('flags isMobile=false for a desktop UA', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit Chrome/120 Safari');
    const state = setupInstallPrompt();
    expect(state.isMobile.value).toBe(false);
  });

  it('flags isInstalled when display-mode standalone matches', () => {
    setStandalone(true);
    const state = setupInstallPrompt();
    expect(state.isInstalled.value).toBe(true);
    expect(state.canInstall.value).toBe(false);
    expect(state.showIOSHint.value).toBe(false);
  });

  it('flags isInstalled when navigator.standalone is true (iOS PWA)', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari');
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
    const state = setupInstallPrompt();
    expect(state.isInstalled.value).toBe(true);
    expect(state.showIOSHint.value).toBe(false);
  });

  it('shows iOS hint on iPhone Safari when not standalone', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari');
    const state = setupInstallPrompt();
    expect(state.showIOSHint.value).toBe(true);
    expect(state.isInstalled.value).toBe(false);
  });

  it('does NOT show iOS hint on non-iOS browsers', () => {
    const state = setupInstallPrompt();
    expect(state.showIOSHint.value).toBe(false);
  });

  it('captures beforeinstallprompt and flags canInstall', () => {
    const state = setupInstallPrompt();
    expect(state.canInstall.value).toBe(false);
    window.dispatchEvent(makeBeforeInstallPromptEvent());
    expect(state.canInstall.value).toBe(true);
  });

  it('prevents the browser default on beforeinstallprompt', () => {
    setupInstallPrompt();
    const event = makeBeforeInstallPromptEvent();
    const spy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  it('promptInstall calls the captured prompt and returns outcome', async () => {
    const state = setupInstallPrompt();
    const event = makeBeforeInstallPromptEvent('accepted');
    window.dispatchEvent(event);
    const outcome = await state.promptInstall();
    expect(outcome).toBe('accepted');
    expect((event as any).prompt).toHaveBeenCalled();
    expect(state.canInstall.value).toBe(false);
  });

  it('promptInstall returns "dismissed" when user cancels', async () => {
    const state = setupInstallPrompt();
    window.dispatchEvent(makeBeforeInstallPromptEvent('dismissed'));
    const outcome = await state.promptInstall();
    expect(outcome).toBe('dismissed');
  });

  it('promptInstall returns "unavailable" without captured event', async () => {
    const state = setupInstallPrompt();
    const outcome = await state.promptInstall();
    expect(outcome).toBe('unavailable');
  });

  it('appinstalled event clears canInstall + sets isInstalled', () => {
    const state = setupInstallPrompt();
    window.dispatchEvent(makeBeforeInstallPromptEvent());
    expect(state.canInstall.value).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(state.canInstall.value).toBe(false);
    expect(state.isInstalled.value).toBe(true);
    expect(state.showIOSHint.value).toBe(false);
  });

  it('dismiss() flips dismissed flag (in-memory, per tab session)', () => {
    const state = setupInstallPrompt();
    expect(state.dismissed.value).toBe(false);
    state.dismiss();
    expect(state.dismissed.value).toBe(true);
  });

  it('setupInstallPrompt is idempotent (listeners attached only once)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    setupInstallPrompt();
    const firstCount = addSpy.mock.calls.length;
    setupInstallPrompt();
    expect(addSpy.mock.calls.length).toBe(firstCount);
    addSpy.mockRestore();
  });
});
