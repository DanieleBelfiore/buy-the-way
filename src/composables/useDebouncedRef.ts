import { ref, watch, onUnmounted, type Ref } from 'vue';

/**
 * Returns a debounced ref that mirrors `source` after `delay` ms of quiet.
 *
 * Each change to the source ref schedules a new timeout, replacing any
 * pending one. Cleared on unmount to avoid stale updates.
 */
export const useDebouncedRef = <T>(source: Ref<T>, delay: number): Ref<T> => {
  const debounced = ref<T>(source.value) as Ref<T>;
  let handle: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (handle !== null) {
      clearTimeout(handle);
      handle = null;
    }
  };

  watch(source, (next) => {
    cancel();
    handle = setTimeout(() => {
      debounced.value = next;
      handle = null;
    }, delay);
  });

  onUnmounted(cancel);

  return debounced;
};
