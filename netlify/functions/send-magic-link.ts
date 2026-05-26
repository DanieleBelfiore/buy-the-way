import type { Context } from '@netlify/functions';
import { Resend } from 'resend';
import admin from 'firebase-admin';
import { checkRateLimit, rateLimitedResponse, RATE_LIMITS } from './_lib/rate-limit';

/**
 * Netlify Function: send-magic-link
 *
 * Generates a Firebase email-link sign-in URL server-side and delivers it via
 * Resend using the same branded template as list invites. Replaces the
 * client-side `sendSignInLinkToEmail` call so locale, copy, and sender domain
 * stay under our control (better deliverability than Firebase's default mail).
 *
 * Auth: none (pre-login). Rate-limited per recipient email.
 *
 * Env vars: RESEND_API_KEY, FIREBASE_SERVICE_ACCOUNT, INVITE_FROM_ADDRESS, APP_URL
 */

interface MagicLinkBody {
  email: string;
  locale: 'it' | 'en';
  /** Dev-only: lets localhost continue URLs through when authorized in Firebase. */
  continueOrigin?: string;
}

const DEFAULT_APP_URL = 'https://buy-the-way.danielebelfiore.dev';

const TEMPLATES = {
  it: {
    subject: 'Accedi a Buy The Way',
    preheader: 'Il tuo link di accesso sicuro',
    greeting: 'Ciao!',
    lead: 'Hai richiesto un link per accedere a Buy The Way.',
    body: 'Clicca il pulsante qui sotto per entrare nell\'app. Il link scade tra poco ed è valido solo per te.',
    cta: 'Accedi a Buy The Way',
    footer:
      'Se non hai richiesto tu questo link, puoi ignorare l\'email.',
    ignore: 'Buy The Way · Fatto con ❤️',
  },
  en: {
    subject: 'Sign in to Buy The Way',
    preheader: 'Your secure sign-in link',
    greeting: 'Hi there!',
    lead: 'You asked for a sign-in link to Buy The Way.',
    body: 'Tap the button below to open the app. The link expires soon and works only for you.',
    cta: 'Sign in to Buy The Way',
    footer:
      'If you didn\'t request this link, you can safely ignore this email.',
    ignore: 'Buy The Way · Made with ❤️',
  },
} as const;

type Locale = keyof typeof TEMPLATES;

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });

const renderHtml = (locale: Locale, signInLink: string, appUrl: string): string => {
  const t = TEMPLATES[locale];
  const logoUrl = `${appUrl}/branding/logo-original.png`;
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(t.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fcfbf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;">
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
                <p style="margin:0 0 16px;font-size:17px;line-height:1.55;color:#1c1c1c;">${t.lead}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5f5f5d;">${t.body}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px;">
                <a
                  href="${signInLink}"
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

const renderText = (locale: Locale, signInLink: string): string => {
  const t = TEMPLATES[locale];
  return [
    t.greeting,
    '',
    t.lead,
    '',
    t.body,
    '',
    `${t.cta}: ${signInLink}`,
    '',
    t.footer,
    '',
    '-- Buy The Way',
  ].join('\n');
};

const initAdmin = (): void => {
  if (admin.apps.length > 0) return;
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) {
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

const resolveContinueUrl = (continueOrigin?: string): string => {
  const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;
  if (continueOrigin && /^https?:\/\/localhost(:\d+)?$/.test(continueOrigin)) {
    return `${continueOrigin}/auth/email-link-callback`;
  }
  return `${appUrl.replace(/\/$/, '')}/auth/email-link-callback`;
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  let body: Partial<MagicLinkBody>;
  try {
    body = (await req.json()) as Partial<MagicLinkBody>;
  } catch {
    return jsonResponse(400, { error: 'bad_json' });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const locale: Locale = isLocale(body.locale) ? body.locale : 'en';
  const continueOrigin = typeof body.continueOrigin === 'string' ? body.continueOrigin.trim() : undefined;

  if (!isEmail(email)) return jsonResponse(400, { error: 'bad_email' });

  try {
    initAdmin();
  } catch (err) {
    console.error('[send-magic-link] admin init failed:', err);
    return jsonResponse(500, { error: 'server_misconfigured' });
  }

  try {
    const decision = await checkRateLimit(
      email,
      RATE_LIMITS.sendMagicLink.funcName,
      RATE_LIMITS.sendMagicLink.max,
      RATE_LIMITS.sendMagicLink.windowMs,
    );
    if (!decision.allowed) return rateLimitedResponse(decision);
  } catch (err) {
    console.warn('[send-magic-link] rate-limit check failed (allowing):', err);
  }

  const continueUrl = resolveContinueUrl(continueOrigin);
  let signInLink: string;
  try {
    signInLink = await admin.auth().generateSignInWithEmailLink(email, {
      url: continueUrl,
      handleCodeInApp: true,
    });
  } catch (err) {
    console.error('[send-magic-link] link generation failed:', err);
    return jsonResponse(500, { error: 'link_generation_failed' });
  }

  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) {
    console.error('[send-magic-link] RESEND_API_KEY is not set');
    return jsonResponse(500, { error: 'server_misconfigured' });
  }
  const from = process.env['INVITE_FROM_ADDRESS'] ?? 'Buy The Way <noreply@buy-the-way.danielebelfiore.dev>';
  const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;

  const resend = new Resend(apiKey);
  const t = TEMPLATES[locale];
  try {
    const result = await resend.emails.send({
      from,
      to: [email],
      subject: t.subject,
      html: renderHtml(locale, signInLink, appUrl),
      text: renderText(locale, signInLink),
      headers: {
        'X-BTW-Email-Kind': 'magic-link',
      },
    });
    if (result.error) {
      console.error('[send-magic-link] Resend rejected:', result.error);
      return jsonResponse(502, { error: 'send_failed', detail: result.error.message });
    }
    return jsonResponse(200, { ok: true, id: result.data?.id });
  } catch (err) {
    console.error('[send-magic-link] exception:', err);
    return jsonResponse(500, { error: 'send_failed' });
  }
};
