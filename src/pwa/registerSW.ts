import { ref, type Ref } from 'vue';

export interface SWState {
  needRefresh: Ref<boolean>;
  offlineReady: Ref<boolean>;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const needRefresh = ref(false);
const offlineReady = ref(false);
let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {};

export const setupServiceWorker = async (): Promise<SWState> => {
  if (import.meta.env.DEV || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { needRefresh, offlineReady, updateServiceWorker };
  }
  try {
    const mod = await import('virtual:pwa-register');
    updateServiceWorker = mod.registerSW({
      immediate: true,
      // Triggered once the SW registers. We use the registration handle to
      // proactively check for a new service worker on three occasions -
      // (a) the moment registration completes (covers hard refreshes and
      // first-load after a deploy), (b) tab regains visibility, (c) window
      // regains focus. Without these, vite-plugin-pwa relies on the browser's
      // implicit update check and users who keep the tab open never see the
      // refresh prompt after a deploy.
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        const checkForUpdate = (): void => {
          registration.update().catch(() => {
            // Network failures are expected (offline, throttled). The next
            // visibility/focus event will retry - no need to surface this.
          });
        };
        checkForUpdate();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        window.addEventListener('focus', checkForUpdate);
      },
      onNeedRefresh() {
        needRefresh.value = true;
      },
      onOfflineReady() {
        offlineReady.value = true;
      },
    });
  } catch (err) {
    console.warn('[pwa] SW registration failed', err);
  }
  return { needRefresh, offlineReady, updateServiceWorker };
};

// Wrap in a closure that dereferences the latest `updateServiceWorker` on each call.
// Without this, consumers capture the initial no-op (set before the dynamic import
// of `virtual:pwa-register` resolves) and clicking "Reload" silently does nothing.
export const useSW = (): SWState => ({
  needRefresh,
  offlineReady,
  updateServiceWorker: (reloadPage?: boolean) => updateServiceWorker(reloadPage),
});
