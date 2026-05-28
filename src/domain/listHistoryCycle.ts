import type { ULID } from '@/domain/id';

const STORAGE_PREFIX = 'btw:historyRecorded:';

const storageKey = (listId: ULID): string => `${STORAGE_PREFIX}${listId}`;

/**
 * Session guard: at most one history write per "shopping cycle" (complete
 * or empty) until the list goes incomplete again or is emptied. Persisted
 * in sessionStorage so a refresh before empty does not re-trigger the
 * empty-list fallback after a completion snapshot. Scoped to the browser tab
 * - a second tab may still rarely double-write.
 */
export const wasListHistoryRecorded = (listId: ULID): boolean => {
  try {
    return sessionStorage.getItem(storageKey(listId)) === '1';
  } catch {
    return false;
  }
};

export const markListHistoryRecorded = (listId: ULID): void => {
  try {
    sessionStorage.setItem(storageKey(listId), '1');
  } catch {
    // Quota or private mode - skip; worst case is a duplicate history entry.
  }
};

export const clearListHistoryRecorded = (listId: ULID): void => {
  try {
    sessionStorage.removeItem(storageKey(listId));
  } catch {
    // ignore
  }
};
