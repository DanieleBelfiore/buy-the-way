import { watch, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

/**
 * Intercepts hardware back / swipe-back while a modal is open: a back gesture
 * closes the modal instead of navigating the underlying route.
 *
 * Each call owns a unique token that is written into `history.state`. Only
 * history entries we pushed ourselves are popped on close - this lets stacked
 * modals coexist and prevents stale `modalOpen` flags left in history.state by
 * earlier navigation from triggering spurious `history.back()` calls.
 *
 * Works for both usage patterns:
 *   - parent `v-if`s the modal (open=true the whole time the component lives)
 *   - parent always renders, toggles `:open` instead
 */
export const useModalBack = (isOpen: Ref<boolean>, close: () => void) => {
  const token = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const ownsCurrentState = (): boolean =>
    !!history.state && (history.state as { modalToken?: string }).modalToken === token;

  const onPopState = () => {
    // Only react when *our* history entry was popped (hardware back / swipe-back).
    // If a stacked child modal closes programmatically it calls history.back()
    // too; the parent still owns the current state and must stay open.
    if (isOpen.value && !ownsCurrentState()) close();
  };

  const sync = (open: boolean) => {
    if (open) {
      if (!ownsCurrentState()) {
        history.pushState({ ...history.state, modalToken: token }, '');
      }
    } else if (ownsCurrentState()) {
      history.back();
    }
  };

  watch(isOpen, sync);

  onMounted(() => {
    window.addEventListener('popstate', onPopState);
    if (isOpen.value) sync(true);
  });

  onUnmounted(() => {
    window.removeEventListener('popstate', onPopState);
    if (ownsCurrentState()) history.back();
  });
};
