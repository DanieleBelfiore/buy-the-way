import type { Context } from '@netlify/functions';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from './_lib/rate-limit';

/**
 * Netlify Function: send-invite
 *
 * Sends a transactional "you've been invited" email to a non-registered user
 * via Resend. Called by the client when a list owner adds a collaborator whose
 * email is not yet in our `users/{uid}` collection - the pending invite is
 * already persisted in Firestore, this function is only the notification leg.
 *
 * Auth: requires a Firebase ID token in the `Authorization: Bearer …` header.
 * Verified server-side with firebase-admin so anyone hitting the endpoint
 * without a valid signed-in identity is rejected with 401.
 *
 * Env vars required (Netlify dashboard → Site → Environment variables):
 *   RESEND_API_KEY              - Resend API key
 *   FIREBASE_SERVICE_ACCOUNT    - full service-account JSON (one line, escaped)
 *   INVITE_FROM_ADDRESS         - sender, e.g. "Buy The Way <noreply@buy-the-way.danielebelfiore.dev>"
 *   APP_URL                     - public app URL, defaults to the prod host
 */

interface InviteBody
{
  email: string;
  listName: string;
  inviterName: string;
  locale: 'it' | 'en';
}

const DEFAULT_APP_URL = 'https://buy-the-way.danielebelfiore.dev';

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

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
  {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });

const renderHtml = (
  locale: Locale,
  inviterName: string,
  listName: string,
  appUrl: string,
): string =>
{
  const t = TEMPLATES[locale];
  const safeInviter = escapeHtml(inviterName);
  const safeList = escapeHtml(listName);
  const logoUrl = `${appUrl}/branding/logo-original.png`;
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${t.subject(safeInviter)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fcfbf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(t.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfbf8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#fcfbf8;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
            <tr>
              <td align="center" style="padding:40px 32px 16px;">
                <img src="${logoUrl}" alt="Buy The Way" width="180" style="display:block;max-width:180px;width:60%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;text-align:center;">
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#1c1c1c;">${t.greeting}</h1>
                <p style="margin:0 0 8px;font-size:17px;line-height:1.55;color:#1c1c1c;">
                  <strong>${safeInviter}</strong> ${t.lead}
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#5f5f5d;">
                  ${t.listLabel}: <strong style="color:#1c1c1c;">${safeList}</strong>
                </p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5f5f5d;">${t.body}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px;">
                <a
                  href="${appUrl}"
                  style="display:inline-block;background:#113261;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:9999px;font-weight:600;font-size:16px;line-height:1;"
                >${t.cta}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;">
                <p style="margin:0;font-size:13px;line-height:1.55;color:#5f5f5d;">${t.footer}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#9d9d9b;">${escapeHtml(t.ignore)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const renderText = (
  locale: Locale,
  inviterName: string,
  listName: string,
  appUrl: string,
): string =>
{
  const t = TEMPLATES[locale];
  return [
    `${t.greeting}`,
    '',
    `${inviterName} ${t.lead}`,
    `${t.listLabel}: ${listName}`,
    '',
    t.body,
    '',
    `${t.cta}: ${appUrl}`,
    '',
    t.footer,
    '',
    '-- Buy The Way',
  ].join('\n');
};

const initAdmin = (): void =>
{
  if (admin.apps.length > 0) return;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw)
  {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
};

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const isLocale = (v: unknown): v is Locale => v === 'it' || v === 'en';
const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default async (req: Request, _ctx: Context): Promise<Response> =>
{
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  // 1. Auth: Firebase ID token
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse(401, { error: 'missing_token' });

  let inviterUid: string;
  try
  {
    initAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    inviterUid = decoded.uid;
  } catch (err)
  {
    console.warn('[send-invite] token verification failed:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  // S2.1: per-uid rate limit. Hard cap at 20 sends per hour. Prevents an
  // attacker with a stolen ID token from blasting Resend invoice + the
  // recipient's inbox; legit sharing flows stay comfortably under the cap.
  try
  {
    const decision = await checkRateLimit(
      inviterUid,
      RATE_LIMITS.sendInvite.funcName,
      RATE_LIMITS.sendInvite.max,
      RATE_LIMITS.sendInvite.windowMs,
    );
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err)
  {
    // Fail-open mirrors find-user: don't let a flaky limiter wedge invites.
    console.warn('[send-invite] rate-limit check failed (allowing):', err);
  }

  // 2. Parse + validate
  let body: Partial<InviteBody>;
  try
  {
    body = (await req.json()) as Partial<InviteBody>;
  } catch
  {
    return jsonResponse(400, { error: 'bad_json' });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const listName = (body.listName ?? '').trim().slice(0, 200);
  const inviterName =
    (body.inviterName ?? '').trim().slice(0, 120) ||
    (body.locale === 'it' ? 'Un amico' : 'A friend');
  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';

  if (!isEmail(email)) return jsonResponse(400, { error: 'bad_email' });
  if (!listName) return jsonResponse(400, { error: 'bad_list_name' });

  // 3. Send via Resend
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey)
  {
    console.error('[send-invite] RESEND_API_KEY is not set');
    return jsonResponse(500, { error: 'server_misconfigured' });
  }
  const from = process.env['INVITE_FROM_ADDRESS'] ?? 'Buy The Way <noreply@buy-the-way.danielebelfiore.dev>';
  const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;

  const resend = new Resend(apiKey);
  try
  {
    const subject = TEMPLATES[locale].subject(inviterName);
    const result = await resend.emails.send({
      from,
      to: [email],
      subject,
      html: renderHtml(locale, inviterName, listName, appUrl),
      text: renderText(locale, inviterName, listName, appUrl),
      headers: {
        'X-BTW-Inviter-Uid': inviterUid,
      },
    });
    if (result.error)
    {
      console.error('[send-invite] Resend rejected:', result.error);
      return jsonResponse(502, { error: 'send_failed', detail: result.error.message });
    }
    return jsonResponse(200, { ok: true, id: result.data?.id });
  } catch (err)
  {
    console.error('[send-invite] exception:', err);
    return jsonResponse(500, { error: 'send_failed' });
  }
};
