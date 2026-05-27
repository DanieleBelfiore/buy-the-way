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

/**
 * Netlify Function: send-magic-link
 *
 * Generates a Firebase email-link sign-in URL server-side and delivers it via
 * Resend using the shared branded template. Rate-limited per recipient email.
 */

interface MagicLinkBody {
  email: string;
  locale: 'it' | 'en';
  /** Dev-only: lets localhost continue URLs through when authorized in Firebase. */
  continueOrigin?: string;
}

const TEMPLATES = {
  it: {
    subject: 'Accedi a Buy The Way',
    preheader: 'Il tuo link di accesso sicuro',
    greeting: 'Ciao!',
    lead: 'Hai richiesto un link per accedere a Buy The Way.',
    body: 'Clicca il pulsante qui sotto per entrare nell\'app. Il link scade tra poco ed è valido solo per te.',
    cta: 'Accedi a Buy The Way',
    footer: 'Se non hai richiesto tu questo link, puoi ignorare l\'email.',
    ignore: 'Buy The Way · Fatto con ❤️',
  },
  en: {
    subject: 'Sign in to Buy The Way',
    preheader: 'Your secure sign-in link',
    greeting: 'Hi there!',
    lead: 'You asked for a sign-in link to Buy The Way.',
    body: 'Tap the button below to open the app. The link expires soon and works only for you.',
    cta: 'Sign in to Buy The Way',
    footer: 'If you didn\'t request this link, you can safely ignore this email.',
    ignore: 'Buy The Way · Made with ❤️',
  },
} as const;

type Locale = keyof typeof TEMPLATES;

const isLocale = (v: unknown): v is Locale => v === 'it' || v === 'en';
const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const resolveContinueUrl = (continueOrigin?: string): string => {
  const appUrl = resolveAppUrl();
  if (continueOrigin && /^https?:\/\/localhost(:\d+)?$/.test(continueOrigin)) {
    return `${continueOrigin}/auth/email-link-callback`;
  }
  return `${appUrl.replace(/\/$/, '')}/auth/email-link-callback`;
};

const renderMagicLinkHtml = (locale: Locale, signInLink: string, appUrl: string): string => {
  const t = TEMPLATES[locale];
  return renderBrandedEmailHtml({
    locale,
    title: t.subject,
    preheader: t.preheader,
    greeting: t.greeting,
    bodyHtml: `
                <p style="margin:0 0 16px;font-size:17px;line-height:1.55;color:#1c1c1c;">${escapeHtml(t.lead)}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5f5f5d;">${escapeHtml(t.body)}</p>`,
    ctaHref: signInLink,
    ctaLabel: t.cta,
    footer: t.footer,
    ignore: t.ignore,
    appUrl,
  });
};

const renderMagicLinkText = (locale: Locale, signInLink: string): string => {
  const t = TEMPLATES[locale];
  return joinPlainTextEmail([
    t.greeting,
    '',
    t.lead,
    '',
    t.body,
    '',
    `${t.cta}: ${signInLink}`,
    '',
    t.footer,
  ]);
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
    console.error('[send-magic-link] rate-limit check failed (denying):', err);
    return rateLimitUnavailableResponse();
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
  const appUrl = resolveAppUrl();

  const resend = new Resend(apiKey);
  const t = TEMPLATES[locale];
  try {
    const result = await resend.emails.send({
      from,
      to: [email],
      subject: t.subject,
      html: renderMagicLinkHtml(locale, signInLink, appUrl),
      text: renderMagicLinkText(locale, signInLink),
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
