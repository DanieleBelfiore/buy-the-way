import { ref, watch } from 'vue';

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

  return { immediate, debounced };
}
