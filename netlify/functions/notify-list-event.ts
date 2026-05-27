import type { Context } from '@netlify/functions';
import admin from 'firebase-admin';
import { checkRateLimit, rateLimitedResponse } from './_lib/rate-limit';
import { initAdmin } from './_lib/firebase-admin';
import { jsonResponse } from './_lib/http';
import { sanitizeFreeText } from './_lib/sanitize';

/**
 * S4.2: server-side fan-out for in-app notifications.
 *
 * Previous incarnation (S4.1) used FCM Web Push to deliver OS-level
 * notifications. That surface bothered users who weren't actively using the
 * app and required browser permissions + a service worker. We swapped it for
 * an in-app inbox: one notification doc per recipient written into
 *   `users/{uid}/notifications/{id}`
 * which the client renders inside a popover anchored to the lists view.
 *
 * SECURITY (C1): the client only passes a minimal descriptor of WHAT
 * happened (kind + listId + optional itemId / targetUid). Body strings are
 * built server-side from data this function reads itself - never from
 * caller-supplied strings - so a collaborator can't craft a phishing
 * payload that renders in another user's inbox.
 *
 * SECURITY (I6): the deep-link target is the listId only; the client maps
 * it to `/lists/{listId}` itself. No caller-controlled URL is accepted.
 *
 * FIFO CAP: each recipient's inbox is capped at 50 docs. After every write
 * we prune the oldest entries beyond the cap. Keeps storage bounded and
 * the popover render cheap.
 */

type NotifyKind = 'item-modified' | 'collaborator-added' | 'collaborator-joined';
type NotifyLocale = 'it' | 'en';

interface NotifyBody {
  listId: string;
  kind: NotifyKind;
  itemId?: string;
  targetUid?: string;
  /**
   * UI locale of the sender. Stored on the notification doc so the
   * recipient's popover can render the body in the sender's language.
   * Restricted to the known enum - tampered clients can pick which
   * canned locale to use, never inject free text. Defaults to `it`.
   */
  locale?: NotifyLocale;
}

const KINDS: ReadonlyArray<NotifyKind> = [
  'item-modified',
  'collaborator-added',
  'collaborator-joined',
];
const LOCALES: ReadonlyArray<NotifyLocale> = ['it', 'en'];

const isNotifyBody = (v: unknown): v is NotifyBody => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.listId !== 'string') return false;
  if (!KINDS.includes(o.kind as NotifyKind)) return false;
  if (o.itemId !== undefined && typeof o.itemId !== 'string') return false;
  if (o.targetUid !== undefined && typeof o.targetUid !== 'string') return false;
  if (o.locale !== undefined && !LOCALES.includes(o.locale as NotifyLocale)) return false;
  return true;
};

/** Per-recipient FIFO cap on the notifications inbox. */
const INBOX_CAP = 50;

const resolveSenderName = async (
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<string> => {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const name = (snap.data() as { displayName?: string } | undefined)?.displayName ?? '';
    return sanitizeFreeText(name, 80);
  } catch {
    return '';
  }
};

interface ResolvedNames {
  itemName?: string;
}

/**
 * Resolve the human-readable subject the popover will render. Only
 * `item-modified` needs a lookup: the popover template renders
 * `{sender} updated {itemName}`. For `collaborator-added` the message
 * goes only to the invitee and reads `{sender} invited you to {listName}`,
 * which uses fields the caller already has - no extra lookup needed.
 *
 * All caller-supplied identifiers are read against Firestore, never
 * reflected back as text - preserves the C1 invariant.
 */
const resolveNames = async (
  db: FirebaseFirestore.Firestore,
  payload: NotifyBody,
): Promise<ResolvedNames> => {
  if (payload.kind !== 'item-modified' || !payload.itemId) return {};
  const itemSnap = await db
    .collection('lists').doc(payload.listId)
    .collection('items').doc(payload.itemId)
    .get();
  const name = sanitizeFreeText(((itemSnap.data() as { name?: string } | undefined)?.name) ?? '', 80);
  return name ? { itemName: name } : {};
};

/**
 * Prune any notifications past the FIFO cap for a recipient. Best-effort:
 * a failure here doesn't surface to the caller, the inbox just stays a
 * little larger until the next write rebalances it.
 */
const pruneInbox = async (
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<void> => {
  try {
    const snap = await db
      .collection('users').doc(uid).collection('notifications')
      .orderBy('createdAt', 'desc')
      .offset(INBOX_CAP)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn(`[notify-list-event] inbox prune failed for ${uid}:`, err);
  }
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse(401, { error: 'missing_token' });

  let callerUid: string;
  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    callerUid = decoded.uid;
  } catch (err) {
    console.warn('[notify-list-event] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  try {
    const decision = await checkRateLimit(callerUid, 'notify-list-event', 240, 60 * 60 * 1000);
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.warn('[notify-list-event] rate-limit check failed (allowing):', err);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'bad_json' });
  }
  if (!isNotifyBody(body)) return jsonResponse(400, { error: 'bad_body' });

  const db = admin.firestore();

  let listSnap;
  try {
    listSnap = await db.collection('lists').doc(body.listId).get();
  } catch (err) {
    console.error('[notify-list-event] list read failed:', err);
    return jsonResponse(500, { error: 'list_read_failed' });
  }
  if (!listSnap.exists) return jsonResponse(404, { error: 'list_not_found' });

  const listData = listSnap.data() as { collaboratorUids?: string[]; name?: string };
  const collaborators = listData.collaboratorUids ?? [];
  if (!collaborators.includes(callerUid)) {
    return jsonResponse(403, { error: 'not_a_collaborator' });
  }

  // Recipient set depends on the event kind:
  //  - item-modified: every collaborator except the caller (the editor).
  //  - collaborator-added: ONLY the new invitee. Existing collaborators
  //    don't see "Carol joined" on invite time.
  //  - collaborator-joined: every collaborator except the caller. Fired
  //    when the invitee first opens the list (first-view detection lives
  //    client-side via lastSeenListMap). Lets the inviter + others know
  //    that the invitee accepted and arrived.
  let recipients: string[];
  if (body.kind === 'collaborator-added') {
    recipients = body.targetUid && body.targetUid !== callerUid
      && collaborators.includes(body.targetUid)
      ? [body.targetUid]
      : [];
  } else {
    recipients = collaborators.filter((u) => u !== callerUid);
  }
  if (recipients.length === 0) {
    return jsonResponse(200, { ok: true, sent: 0 });
  }

  const senderName = await resolveSenderName(db, callerUid);
  let resolved: ResolvedNames;
  try {
    resolved = await resolveNames(db, body);
  } catch (err) {
    console.error('[notify-list-event] name resolve failed:', err);
    return jsonResponse(500, { error: 'name_resolve_failed' });
  }

  const now = Date.now();
  const listName = sanitizeFreeText(listData.name ?? '', 80);
  const locale: NotifyLocale = body.locale && LOCALES.includes(body.locale)
    ? body.locale
    : 'it';

  // Doc stores the structured slots only; the recipient's popover renders
  // the final string using its own i18n table keyed by `kind` + `locale`.
  // No body text travels over the wire, which keeps the C1 invariant
  // (caller-supplied strings never reach a notification surface) trivially
  // true even for the popover - the only free-text slots are `itemName`
  // and `senderName`, both read from Firestore by this function, never
  // lifted from the caller payload.
  const writes = recipients.map(async (uid) => {
    try {
      const ref = db.collection('users').doc(uid).collection('notifications').doc();
      const docPayload: Record<string, unknown> = {
        kind: body.kind,
        listId: body.listId,
        listName,
        senderUid: callerUid,
        senderName,
        locale,
        createdAt: now,
      };
      if (body.itemId) docPayload.itemId = body.itemId;
      if (resolved.itemName) docPayload.itemName = resolved.itemName;
      await ref.set(docPayload);
      await pruneInbox(db, uid);
      return true;
    } catch (err) {
      console.warn(`[notify-list-event] write failed for ${uid}:`, err);
      return false;
    }
  });

  const results = await Promise.all(writes);
  const sent = results.filter(Boolean).length;
  const failed = results.length - sent;

  return jsonResponse(200, { ok: true, sent, failed });
};
