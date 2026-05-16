import { ref, watch, onUnmounted, getCurrentInstance } from 'vue';

export function useDebouncedRef<T>(initial: T, delay = 200) {
  const immediate = ref<T>(initial);
  const debounced = ref<T>(initial);
  let timer: ReturnType<typeof setTimeout>;

  watch(immediate, (val) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      (debounced as { value: T }).value = val;
    }, delay);
  });

  // Clear pending timer on component unmount to avoid post-unmount reactive updates.
  // Guard with getCurrentInstance so the composable is also safe outside component context.
  if (getCurrentInstance()) {
    onUnmounted(() => clearTimeout(timer));
  }

  return { immediate, debounced };
}
