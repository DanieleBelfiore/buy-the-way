/** How often to ask the browser to check for a new service worker while the app is open. */
export const SW_UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let focusHandler: (() => void) | null = null;

export const detachServiceWorkerUpdateChecks = (): void => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (focusHandler) {
    window.removeEventListener('focus', focusHandler);
    focusHandler = null;
  }
};

/**
 * Proactively check for a waiting service worker: on attach, when the tab
 * becomes visible, on window focus, and on a fixed hourly interval.
 */
export const attachServiceWorkerUpdateChecks = (
  registration: ServiceWorkerRegistration,
): void => {
  detachServiceWorkerUpdateChecks();

  const checkForUpdate = (): void => {
    registration.update().catch(() => {
      // Offline / throttled - next visibility, focus, or poll will retry.
    });
  };

  checkForUpdate();

  visibilityHandler = (): void => {
    if (document.visibilityState === 'visible') checkForUpdate();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  focusHandler = checkForUpdate;
  window.addEventListener('focus', focusHandler);

  pollTimer = setInterval(checkForUpdate, SW_UPDATE_POLL_INTERVAL_MS);
};
