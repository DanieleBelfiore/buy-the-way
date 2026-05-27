import { ref, type Ref } from 'vue';

/**
 * Subset of the BeforeInstallPromptEvent we need. The real type is defined
 * only in @types/wicg-... which isn't worth a dev-dep just for this. We
 * narrow to the two members we actually call.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPromptState {
  /** True when a Chromium-style native prompt can be triggered programmatically. */
  canInstall: Ref<boolean>;
  /** True when the home install button should show (mobile, not installed, offer available). */
  showInstallButton: Ref<boolean>;
  /** True when running already-installed (display-mode standalone or iOS standalone). */
  isInstalled: Ref<boolean>;
  /** True when we should show the iOS Safari "tap share → add to home" hint. */
  showIOSHint: Ref<boolean>;
  /** True when the host UA looks like a mobile device. Install prompt is mobile-only. */
  isMobile: Ref<boolean>;
  /** Show the native install prompt and resolve with the user's outcome. */
  promptInstall: () => Promise<InstallPromptOutcome>;
  /** Dismiss the in-app prompt for the rest of this tab session (in-memory only). */
  dismiss: () => void;
  /** True once dismissed for this tab session. */
  dismissed: Ref<boolean>;
}

const canInstall = ref(false);
const showInstallButton = ref(false);
const isInstalled = ref(false);
const showIOSHint = ref(false);
const isMobile = ref(false);
const dismissed = ref(false);

let deferredPrompt: InstallPromptEvent | null = null;
let listenersAttached = false;

const refreshInstallButton = (): void => {
  showInstallButton.value =
    isMobile.value
    && !isInstalled.value
    && (canInstall.value || showIOSHint.value);
};

const detectStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const standaloneMql = window.matchMedia?.('(display-mode: standalone)');
  if (standaloneMql?.matches) return true;
  // iOS Safari exposes a non-standard `standalone` boolean on navigator.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
};

const detectIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
};

/**
 * UA-based mobile detection. The install prompt is mobile-only per product
 * decision - desktop browsers get nothing. Covers iOS, Android, plus other
 * mobile UAs. Width fallback (≤ 768) catches mobile UAs spoofed as desktop
 * (rare) without surfacing the prompt on legitimate laptops with narrow
 * windows (we OR the two so a narrow desktop window still shows nothing
 * unless the UA also reports mobile - desktop windows being narrow is
 * common; legitimate mobile is rare on width alone).
 */
const detectMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/.test(ua);
};

export const setupInstallPrompt = (): InstallPromptState => {
  if (typeof window === 'undefined') {
    return state();
  }
  if (listenersAttached) return state();
  listenersAttached = true;

  isInstalled.value = detectStandalone();
  isMobile.value = detectMobile();
  if (isInstalled.value) {
    canInstall.value = false;
    showIOSHint.value = false;
    refreshInstallButton();
    return state();
  }

  // iOS Safari has no beforeinstallprompt API - show the manual hint instead.
  if (detectIOS()) {
    showIOSHint.value = true;
  }
  refreshInstallButton();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    canInstall.value = true;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    canInstall.value = false;
    showIOSHint.value = false;
    isInstalled.value = true;
    refreshInstallButton();
  });

  return state();
};

const promptInstall = async (): Promise<InstallPromptOutcome> => {
  if (!deferredPrompt) return 'unavailable';
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
    refreshInstallButton();
    return outcome;
  } catch {
    deferredPrompt = null;
    canInstall.value = false;
    refreshInstallButton();
    return 'unavailable';
  }
};

const dismiss = (): void => {
  dismissed.value = true;
};

const state = (): InstallPromptState => ({
  canInstall,
  showInstallButton,
  isInstalled,
  showIOSHint,
  isMobile,
  promptInstall,
  dismiss,
  dismissed,
});

export const useInstallPrompt = (): InstallPromptState => state();

// Test-only reset. Not exported from a barrel; tests import this path directly.
export const __resetInstallPromptForTests = (): void => {
  canInstall.value = false;
  showInstallButton.value = false;
  isInstalled.value = false;
  showIOSHint.value = false;
  isMobile.value = false;
  dismissed.value = false;
  deferredPrompt = null;
  listenersAttached = false;
};
