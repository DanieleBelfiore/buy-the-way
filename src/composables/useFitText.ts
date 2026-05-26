import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

export interface UseFitTextOptions {
  /** Minimum scale factor applied to the inner text. Default 0.55. */
  minScale?: number;
  /** Maximum scale factor (usually 1 - no zoom-in beyond the natural size). */
  maxScale?: number;
}

/**
 * Shrinks the inner text inside `innerRef` until it fits on a single line
 * within `containerRef`. Uses `transform: scale(...)` from the left edge so
 * the text origin stays anchored where the layout expects it. Re-measures
 * on `ResizeObserver` of the container AND on any change to `watchSource`
 * (so editing the text re-triggers a fit).
 *
 * Why scale and not font-size: scale doesn't reflow the surrounding layout
 * (avoids loops with the very ResizeObserver we register). It does mean the
 * visual height stays constant at the natural font-size's line height -
 * desirable for a list row where every row must share a baseline.
 */
export const useFitText = (
  innerRef: Ref<HTMLElement | null>,
  containerRef: Ref<HTMLElement | null>,
  watchSource: Ref<unknown>,
  options: UseFitTextOptions = {},
): { scale: Ref<number> } => {
  const { minScale = 0.55, maxScale = 1 } = options;
  const scale = ref(1);

  let observer: ResizeObserver | null = null;

  const measure = (): void => {
    const inner = innerRef.value;
    const container = containerRef.value;
    if (!inner || !container) return;
    // Reset to baseline so scrollWidth reflects the natural width every pass.
    inner.style.transform = '';
    inner.style.transformOrigin = 'left center';
    const available = container.clientWidth;
    const natural = inner.scrollWidth;
    if (natural <= 0 || available <= 0) {
      scale.value = maxScale;
      return;
    }
    const ratio = available / natural;
    const next = Math.max(minScale, Math.min(maxScale, ratio));
    scale.value = next;
    inner.style.transform = `scale(${next})`;
  };

  onMounted(() => {
    measure();
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      observer = new ResizeObserver(() => {
        measure();
      });
      observer.observe(containerRef.value);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  watch(watchSource, () => {
    // Defer so the DOM commits the new text before we measure scrollWidth.
    queueMicrotask(measure);
  });

  return { scale };
};
