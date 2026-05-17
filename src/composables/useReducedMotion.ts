import { ref, onMounted, onUnmounted, type Ref } from 'vue';

export const useReducedMotion = (): Ref<boolean> => {
  const reduced = ref(false);
  let mql: MediaQueryList | null = null;

  const update = (): void => {
    reduced.value = mql?.matches ?? false;
  };

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.value = mql.matches;
    mql.addEventListener?.('change', update);
  });

  onUnmounted(() => {
    mql?.removeEventListener?.('change', update);
    mql = null;
  });

  return reduced;
};

export const prefersReducedMotionSync = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
