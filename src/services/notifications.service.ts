import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { NotificationDoc } from '@/domain/types';

/**
 * S4.2: in-app notifications inbox.
 *
 * Storage: `users/{uid}/notifications/{notifId}`. Server-only writes (rules
 * deny client writes). Recipient may read + delete their own docs.
 *
 * Lifecycle: the popover renders the current snapshot, then immediately
 * batch-deletes everything it showed. The realtime listener wired up by
 * `subscribeNotifications` is what drives both the unread badge and the
 * empty-state once the deletes propagate back.
 */

const notificationsCol = (uid: string) =>
  collection(db, 'users', uid, 'notifications');

export type NotificationsListener = (notifications: NotificationDoc[]) => void;

/**
 * Subscribe to the signed-in user's notifications, ordered newest first.
 * Returns an unsubscribe function the caller must invoke on teardown.
 */
export const subscribeNotifications = (
  uid: string,
  onUpdate: NotificationsListener,
): (() => void) => {
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: NotificationDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<NotificationDoc, 'id'>;
        list.push({ id: d.id, ...data });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[notifications] subscription error:', err);
    },
  );
};

/**
 * Delete the supplied notifications in a single batch. Caller passes the
 * IDs it just rendered so concurrent server writes that arrive after the
 * popover opens are not silently dropped.
 *
 * Firestore caps a batch at 500 ops; we chunk defensively even though the
 * per-user inbox is bounded to 50.
 */
const BATCH_CAP = 500;

export const deleteNotifications = async (
  uid: string,
  ids: readonly string[],
): Promise<void> => {
  if (ids.length === 0) return;
  const col = notificationsCol(uid);
  for (let i = 0; i < ids.length; i += BATCH_CAP) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_CAP)) {
      batch.delete(doc(col, id));
    }
    await batch.commit();
  }
};

/**
 * Account-delete cascade helper: enumerate and delete every notification doc
 * for `uid`. Best-effort; failures are logged and swallowed so account-delete
 * still completes even if this purge stalls.
 */
export const deleteAllNotifications = async (uid: string): Promise<void> => {
  try {
    const snap = await getDocs(notificationsCol(uid));
    if (snap.empty) return;
    await deleteNotifications(uid, snap.docs.map((d) => d.id));
  } catch (err) {
    console.warn('[notifications] deleteAllNotifications failed:', err);
  }
};
