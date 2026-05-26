import { ref, computed, readonly } from 'vue';

/**
 * S3.2: shared bulk-selection state used by ListDetailView (rows) and the
 * bulk-action toolbar. Owns the `active` mode flag plus the set of selected
 * IDs; views drive transitions via the small action surface returned here.
 *
 * Pattern intentionally low-tech: no generics over item shape, just IDs.
 * Callers pair an ID set with their existing item arrays.
 */
export const useBulkSelection = () => {
  const _active = ref(false);
  const _selected = ref<Set<string>>(new Set());

  const count = computed(() => _selected.value.size);
  const isEmpty = computed(() => _selected.value.size === 0);

  const has = (id: string): boolean => _selected.value.has(id);

  const enter = (initialId?: string): void => {
    _active.value = true;
    const next = new Set<string>();
    if (initialId) next.add(initialId);
    _selected.value = next;
  };

  const exit = (): void => {
    _active.value = false;
    _selected.value = new Set();
  };

  const toggle = (id: string): void => {
    const next = new Set(_selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    _selected.value = next;
    // Auto-exit when the user deselects the last row - the toolbar's no
    // longer useful and staying in mode traps the user.
    if (next.size === 0) _active.value = false;
  };

  const selectAll = (ids: readonly string[]): void => {
    _selected.value = new Set(ids);
    _active.value = ids.length > 0;
  };

  const snapshot = (): string[] => Array.from(_selected.value);

  return {
    active: readonly(_active),
    selected: readonly(_selected),
    count,
    isEmpty,
    has,
    enter,
    exit,
    toggle,
    selectAll,
    snapshot,
  };
};
