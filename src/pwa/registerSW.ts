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
    const mod = await import(/* @vite-ignore */ 'virtual:pwa-register');
    updateServiceWorker = mod.registerSW({
      immediate: true,
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

export const useSW = (): SWState => ({ needRefresh, offlineReady, updateServiceWorker });
