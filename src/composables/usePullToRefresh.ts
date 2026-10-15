import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { useHaptic } from './useHaptic';

/** Pull distance (px, after damping) that triggers a refresh on release. */
export const PULL_THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;
// The indicator follows the finger at half speed, so the gesture feels elastic.
const DAMPING = 0.5;

/**
 * Pull-to-refresh on a scroll container. The browser's own gesture is off
 * (`overscroll-behavior-y: none` in global.css) and missing in an installed
 * iOS PWA, so this rebuilds it for touch only: it arms when a touch starts
 * with the container scrolled to the top and moves down.
 */
export const usePullToRefresh = (
  target: Ref<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
  isBlocked: () => boolean = () => false,
): { pull: Ref<number>; pulling: Ref<boolean>; refreshing: Ref<boolean> } => {
  const pull = ref(0);
  const pulling = ref(false);
  const refreshing = ref(false);
  const { pulse } = useHaptic();
  let startY: number | null = null;
  let el: HTMLElement | null = null;

  const reset = (): void => {
    startY = null;
    pulling.value = false;
    pull.value = 0;
  };

  const onStart = (e: TouchEvent): void => {
    if (refreshing.value || isBlocked() || e.touches.length !== 1 || (el?.scrollTop ?? 0) > 0) return;
    startY = e.touches[0]!.clientY;
  };

  const onMove = (e: TouchEvent): void => {
    if (startY === null) return;
    if (isBlocked()) return reset();
    const dy = e.touches[0]!.clientY - startY;
    if (dy <= 0 || (el?.scrollTop ?? 0) > 0) {
      // Scrolling up into the list: hand the gesture back to the browser.
      if (pulling.value) reset();
      return;
    }
    // Stop the native scroll / rubber band while the pull owns the gesture.
    if (e.cancelable) e.preventDefault();
    const next = Math.min(dy * DAMPING, MAX_PULL_PX);
    if (pull.value < PULL_THRESHOLD_PX && next >= PULL_THRESHOLD_PX) pulse();
    pulling.value = true;
    pull.value = next;
  };

  const onEnd = async (): Promise<void> => {
    if (startY === null) return;
    const armed = pull.value >= PULL_THRESHOLD_PX;
    startY = null;
    pulling.value = false;
    if (!armed) {
      pull.value = 0;
      return;
    }
    pull.value = PULL_THRESHOLD_PX;
    refreshing.value = true;
    try {
      await onRefresh();
    } finally {
      refreshing.value = false;
      pull.value = 0;
    }
  };

  onMounted(() => {
    el = target.value;
    if (!el) return;
    el.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: onMove calls preventDefault while pulling.
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', reset);
  });

  onUnmounted(() => {
    el?.removeEventListener('touchstart', onStart);
    el?.removeEventListener('touchmove', onMove);
    el?.removeEventListener('touchend', onEnd);
    el?.removeEventListener('touchcancel', reset);
    el = null;
  });

  return { pull, pulling, refreshing };
};
