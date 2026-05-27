import type { Context } from '@netlify/functions';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import {
  checkRateLimit,
  rateLimitedResponse,
  rateLimitUnavailableResponse,
  RATE_LIMITS,
} from './_lib/rate-limit';
import { initAdmin } from './_lib/firebase-admin';
import { jsonResponse } from './_lib/http';
import {
  escapeHtml,
  joinPlainTextEmail,
  renderBrandedEmailHtml,
  resolveAppUrl,
} from './_lib/branded-email';
import { sanitizeFreeText } from './_lib/sanitize';

/**
 * Netlify Function: send-invite
 *
 * Sends a transactional invite email via Resend. Requires list admin auth,
 * pending invite on the list, and derives copy from Firestore.
 */

interface InviteBody {
  email: string;
  listId: string;
  locale: 'it' | 'en';
}

interface ListDoc {
  name?: string;
  ownerUid?: string;
  admins?: string[];
  pendingInviteEmails?: string[];
}

const TEMPLATES = {
  it: {
    subject: (n: string) => `${n} ti ha invitato a Buy The Way 🛒`,
    preheader: 'La tua lista della spesa intelligente',
    greeting: 'Ciao!',
    lead: 'ti ha invitato a unirti a una lista della spesa condivisa.',
    listLabel: 'Lista',
    body: "Buy The Way è un'app gratuita e mobile-first per organizzare la spesa con familiari o coinquilini: aggiungi, spunta e sincronizza in tempo reale.",
    cta: 'Iscriviti e apri la lista',
    footer:
      "Iscriviti con il tuo account Google: la lista ti aspetterà già fra le tue. Se non riconosci questo invito, puoi ignorare l'email.",
    ignore: 'Buy The Way · Fatto con ❤️',
  },
  en: {
    subject: (n: string) => `${n} invited you to Buy The Way 🛒`,
    preheader: 'Your smart shopping list',
    greeting: 'Hi there!',
    lead: 'invited you to join a shared shopping list.',
    listLabel: 'List',
    body: 'Buy The Way is a free, mobile-first app for organising groceries with family or housemates: add, check off and sync in real time.',
    cta: 'Sign in and open the list',
    footer:
      "Sign in with your Google account - the list will be waiting for you. If you don't recognise this invite, simply ignore this email.",
    ignore: 'Buy The Way · Made with ❤️',
  },
} as const;

type Locale = keyof typeof TEMPLATES;

const adminsOf = (listData: ListDoc): string[] => {
  if (listData.admins && listData.admins.length > 0) return [...listData.admins];
  return listData.ownerUid ? [listData.ownerUid] : [];
};

const isListAdmin = (listData: ListDoc, uid: string): boolean =>
  adminsOf(listData).includes(uid);

const defaultInviterName = (locale: Locale): string =>
  locale === 'it' ? 'Un amico' : 'A friend';

const resolveInviterName = async (
  db: FirebaseFirestore.Firestore,
  inviterUid: string,
  locale: Locale,
): Promise<string> => {
  try {
    const snap = await db.collection('users').doc(inviterUid).get();
    const data = snap.data() as { displayName?: string; email?: string } | undefined;
    const fromDisplay = sanitizeFreeText(data?.displayName ?? '');
    if (fromDisplay) return fromDisplay;
    const email = (data?.email ?? '').trim();
    if (email) {
      const local = sanitizeFreeText(email.split('@')[0] ?? '');
      if (local) return local;
    }
  } catch (err) {
    console.warn('[send-invite] inviter profile read failed:', err);
  }
  return defaultInviterName(locale);
};

const renderInviteHtml = (
  locale: Locale,
  inviterName: string,
  listName: string,
  appUrl: string,
): string => {
  const t = TEMPLATES[locale];
  const safeInviter = escapeHtml(inviterName);
  const safeList = escapeHtml(listName);
  return renderBrandedEmailHtml({
    locale,
    title: t.subject(inviterName),
    preheader: t.preheader,
    greeting: t.greeting,
    bodyHtml: `
                <p style="margin:0 0 8px;font-size:17px;line-height:1.55;color:#1c1c1c;">
                  <strong>${safeInviter}</strong> ${escapeHtml(t.lead)}
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#5f5f5d;">
                  ${escapeHtml(t.listLabel)}: <strong style="color:#1c1c1c;">${safeList}</strong>
                </p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5f5f5d;">${escapeHtml(t.body)}</p>`,
    ctaHref: appUrl,
    ctaLabel: t.cta,
    footer: t.footer,
    ignore: t.ignore,
    appUrl,
  });
};

const renderInviteText = (
  locale: Locale,
  inviterName: string,
  listName: string,
  appUrl: string,
): string => {
  const t = TEMPLATES[locale];
  return joinPlainTextEmail([
    t.greeting,
    '',
    `${inviterName} ${t.lead}`,
    `${t.listLabel}: ${listName}`,
    '',
    t.body,
    '',
    `${t.cta}: ${appUrl}`,
    '',
    t.footer,
  ]);
};

const isLocale = (v: unknown): v is Locale => v === 'it' || v === 'en';
const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse(401, { error: 'missing_token' });

  let inviterUid: string;
  try {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    inviterUid = decoded.uid;
  } catch (err) {
    console.warn('[send-invite] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  try {
    const decision = await checkRateLimit(
      inviterUid,
      RATE_LIMITS.sendInvite.funcName,
      RATE_LIMITS.sendInvite.max,
      RATE_LIMITS.sendInvite.windowMs,
    );
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.error('[send-invite] rate-limit check failed (denying):', err);
    return rateLimitUnavailableResponse();
  }

  let body: Partial<InviteBody>;
  try {
    body = (await req.json()) as Partial<InviteBody>;
  } catch {
    return jsonResponse(400, { error: 'bad_json' });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const listId = (body.listId ?? '').trim();
  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';

  if (!isEmail(email)) return jsonResponse(400, { error: 'bad_email' });
  if (!listId) return jsonResponse(400, { error: 'bad_list_id' });

  const db = admin.firestore();

  let listData: ListDoc;
  try {
    const listSnap = await db.collection('lists').doc(listId).get();
    if (!listSnap.exists) {
      return jsonResponse(404, { error: 'list_not_found' });
    }
    listData = listSnap.data() as ListDoc;
  } catch (err) {
    console.error('[send-invite] list read failed:', err);
    return jsonResponse(500, { error: 'list_read_failed' });
  }

  if (!isListAdmin(listData, inviterUid)) {
    return jsonResponse(403, { error: 'not_list_admin' });
  }

  const pending = (listData.pendingInviteEmails ?? []).map((e) => e.trim().toLowerCase());
  if (!pending.includes(email)) {
    return jsonResponse(403, { error: 'invite_not_pending' });
  }

  const listName = sanitizeFreeText(listData.name ?? '', 200);
  if (!listName) {
    return jsonResponse(400, { error: 'bad_list_name' });
  }

  const inviterName = await resolveInviterName(db, inviterUid, locale);

  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) {
    console.error('[send-invite] RESEND_API_KEY is not set');
    return jsonResponse(500, { error: 'server_misconfigured' });
  }
  const from = process.env['INVITE_FROM_ADDRESS'] ?? 'Buy The Way <noreply@buy-the-way.danielebelfiore.dev>';
  const appUrl = resolveAppUrl();

  const resend = new Resend(apiKey);
  try {
    const subject = TEMPLATES[locale].subject(inviterName);
    const result = await resend.emails.send({
      from,
      to: [email],
      subject,
      html: renderInviteHtml(locale, inviterName, listName, appUrl),
      text: renderInviteText(locale, inviterName, listName, appUrl),
      headers: {
        'X-BTW-Inviter-Uid': inviterUid,
        'X-BTW-List-Id': listId,
      },
    });
    if (result.error) {
      console.error('[send-invite] Resend rejected:', result.error);
      return jsonResponse(502, { error: 'send_failed', detail: result.error.message });
    }
    return jsonResponse(200, { ok: true, id: result.data?.id });
  } catch (err) {
    console.error('[send-invite] exception:', err);
    return jsonResponse(500, { error: 'send_failed' });
  }
};
