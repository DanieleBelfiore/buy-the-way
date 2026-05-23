import { watch, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

/**
 * Intercepts the hardware back button (or swipe back) when a modal is open.
 * Instead of navigating back, it closes the modal.
 */
export const useModalBack = (isOpen: Ref<boolean>, close: () => void) => {
  const onPopState = () => {
    if (isOpen.value) {
      // User pressed back button: close the modal
      close();
    }
  };

  watch(isOpen, (newVal) => {
    if (newVal) {
      // When modal opens, push a new state to the browser history
      if (!history.state?.modalOpen) {
        history.pushState({ ...history.state, modalOpen: true }, '');
      }
    } else {
      // When modal closes programmatically (e.g. by clicking 'X' or saving)
      // and we are still on the modal's history state, we go back to clean it up
      if (history.state?.modalOpen) {
        history.back();
      }
    }
  });

  onMounted(() => {
    window.addEventListener('popstate', onPopState);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', onPopState);
    if (history.state?.modalOpen) {
      history.back();
    }
  });
};
