import { ref, readonly, onBeforeUnmount } from 'vue';

/**
 * S3.1: orchestrates a single "pending delete" + countdown toast so the user
 * can undo within a short window before the firestore write fires.
 *
 * The composable owns the timer and the pending-task state. The caller owns:
 *  - the optimistic hide (e.g. `itemsStore.markPendingDelete`) which is
 *    invoked BEFORE `schedule()` so the row disappears immediately;
 *  - the actual firestore call (`commit`) which runs once the window expires;
 *  - the undo cleanup (`onUndo`) which restores the optimistic hide.
 *
 * If a second delete is scheduled while one is pending, the first commits
 * immediately so we never silently swallow a user's intent. Same on
 * `onBeforeUnmount` - leaving the view flushes any in-flight task.
 */
export interface UndoTask {
  /** Stable identifier for the deleted resource (used by tests + dedup). */
  id: string;
  /** User-facing copy shown in the toast. */
  message: string;
  /** Auto-commit timeout in milliseconds. Defaults to 1_000. */
  durationMs?: number;
  /** Firestore (or other authoritative) call to run when the window expires. */
  commit: () => Promise<void> | void;
  /** Optional cleanup invoked when the user presses Undo. */
  onUndo?: () => void;
}

interface ActiveTask extends Required<Omit<UndoTask, 'onUndo'>> {
  onUndo?: () => void;
}

const DEFAULT_DURATION_MS = 1_000;

export const useUndoDelete = () => {
  const _pending = ref<ActiveTask | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  // I4: track the in-flight commit as a promise (not a bare boolean) so a
  // follow-up `commitCurrent` can deterministically chain after the prior
  // one settles instead of returning early and stranding the new task.
  let inFlight: Promise<void> | null = null;

  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const commitCurrent = async (): Promise<void> => {
    // If another commit is mid-flight, wait for it to settle before we
    // decide whether to fire this one. This prevents the race where a
    // freshly-scheduled task is silently skipped because the prior task's
    // commit hadn't released the flag yet.
    if (inFlight) {
      try { await inFlight; } catch { /* prior failure already logged */ }
    }
    const task = _pending.value;
    if (!task) return;
    clearTimer();
    const run = (async () => {
      try {
        await task.commit();
      } catch (err) {
        console.error('[useUndoDelete] commit failed:', err);
      } finally {
        // Only clear the pending slot if it still points at the task we
        // just flushed - a `schedule()` call during commit may have already
        // installed a successor task that must survive.
        if (_pending.value === task) _pending.value = null;
      }
    })();
    inFlight = run;
    try {
      await run;
    } finally {
      // Only release the flag if we're still the latest commit. A follow-up
      // commit (chained from another `commitCurrent` call) will have
      // overwritten `inFlight`; leave it alone in that case.
      if (inFlight === run) inFlight = null;
    }
  };

  const undoCurrent = (): void => {
    const task = _pending.value;
    if (!task) return;
    clearTimer();
    _pending.value = null;
    task.onUndo?.();
  };

  const schedule = (task: UndoTask): void => {
    // Flush any prior task FIRST so deletes never get silently swallowed by a
    // follow-up. The new task starts fresh once the previous commit settles.
    if (_pending.value) void commitCurrent();
    const active: ActiveTask = {
      id: task.id,
      message: task.message,
      durationMs: task.durationMs ?? DEFAULT_DURATION_MS,
      commit: task.commit,
      ...(task.onUndo ? { onUndo: task.onUndo } : {}),
    };
    _pending.value = active;
    timer = setTimeout(() => {
      void commitCurrent();
    }, active.durationMs);
  };

  onBeforeUnmount(() => {
    if (_pending.value) void commitCurrent();
  });

  return {
    /** Read-only view of the current pending task (or null). */
    pending: readonly(_pending),
    schedule,
    undoCurrent,
    commitCurrent,
  };
};
