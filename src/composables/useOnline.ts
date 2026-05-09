import { onMounted, onUnmounted, ref, type Ref } from 'vue';

/**
 * Reactive online/offline status.
 *
 * Initial value is `true` outside the browser (SSR / tests without DOM)
 * and reflects `window.navigator.onLine` in the browser. Subscribes to
 * `online` / `offline` window events and tears them down on unmount.
 */
export const useOnline = (): { isOnline: Ref<boolean> } => {
  const initial = typeof window !== 'undefined' ? window.navigator.onLine : true;
  const isOnline = ref<boolean>(initial);

  const handleOnline = (): void => {
    isOnline.value = true;
  };
  const handleOffline = (): void => {
    isOnline.value = false;
  };

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    isOnline.value = window.navigator.onLine;
  });

  onUnmounted(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  return { isOnline };
};
