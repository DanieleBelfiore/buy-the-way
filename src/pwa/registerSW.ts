import { ref, type Ref } from 'vue';
import { attachServiceWorkerUpdateChecks } from '@/pwa/serviceWorkerUpdates';

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
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        attachServiceWorkerUpdateChecks(registration);
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

/**
 * Manual refresh (pull-to-refresh): check for a new build first and, when one
 * is already waiting, activate it instead of reloading into the old one.
 * Otherwise a plain reload. Offline or without a service worker the check
 * fails silently and the page still reloads.
 */
export const refreshApp = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    if (needRefresh.value || registration?.waiting) {
      // updateServiceWorker reloads once the new worker takes control; the
      // timer covers a worker that never does, so the spinner cannot hang.
      setTimeout(() => window.location.reload(), 3000);
      await updateServiceWorker(true);
      return;
    }
  } catch {
    // Fall through to the plain reload.
  }
  window.location.reload();
};

// Wrap in a closure that dereferences the latest `updateServiceWorker` on each call.
// Without this, consumers capture the initial no-op (set before the dynamic import
// of `virtual:pwa-register` resolves) and clicking "Reload" silently does nothing.
export const useSW = (): SWState => ({
  needRefresh,
  offlineReady,
  updateServiceWorker: (reloadPage?: boolean) => updateServiceWorker(reloadPage),
});
