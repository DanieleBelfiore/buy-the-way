import { getAuth } from 'firebase/auth';
import { i18n } from '@/i18n/index';
import type { Locale } from '@/domain/types';

/**
 * S4.2: thin fetch wrapper around the `notify-list-event` netlify function.
 *
 * Fire-and-forget by design: callers (updateItem, addCollaborator, …) MUST
 * NOT await this in a way that blocks the user. The Firestore write is the
 * source of truth; the inbox doc is best-effort.
 *
 * C1 hardening: the payload only describes WHAT happened (kind + listId +
 * optional itemId/targetUid) plus the caller's UI locale. The body string
 * is templated server-side from trusted Firestore data - never from
 * caller-supplied strings. `locale` is restricted to the known enum, so a
 * tampered client can only pick which canned template to render, not
 * inject arbitrary text.
 */
export type NotifyKind =
  | 'item-modified'
  | 'collaborator-added'
  | 'collaborator-joined';

export interface NotifyEventPayload {
  listId: string;
  kind: NotifyKind;
  /** For `item-modified`. */
  itemId?: string;
  /** For `collaborator-added`. */
  targetUid?: string;
}

const ALLOWED_LOCALES: ReadonlyArray<Locale> = ['it', 'en'];

const senderLocale = (): Locale => {
  const raw = (i18n.global.locale as { value: Locale }).value;
  return ALLOWED_LOCALES.includes(raw) ? raw : 'it';
};

export const notifyListEvent = async (payload: NotifyEventPayload): Promise<void> => {
  try {
    const user = getAuth().currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/.netlify/functions/notify-list-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ ...payload, locale: senderLocale() }),
      keepalive: true,
    });
  } catch (err) {
    // Best-effort: failed notifications never surface to users.
    console.warn('[notify] dispatch failed:', err);
  }
};
