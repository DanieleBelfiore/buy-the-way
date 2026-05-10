import { registerSW } from 'virtual:pwa-register';
import { useToasts } from '@/composables/useToasts';

export function initPWA(): void {
  const { addToast } = useToasts();
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

  updateSW = registerSW({
    onNeedRefresh() {
      addToast('Update available', {
        label: 'Refresh',
        fn: () => updateSW?.(true),
      });
    },
    onOfflineReady() {
      addToast('Ready to work offline');
    },
  });
}
