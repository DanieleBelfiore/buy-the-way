export const DEFAULT_APP_URL = 'https://buy-the-way.danielebelfiore.dev';

export const resolveAppUrl = (): string => process.env['APP_URL'] ?? DEFAULT_APP_URL;

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });

export interface BrandedEmailHtml {
  locale: 'it' | 'en';
  title: string;
  preheader: string;
  /** Inner HTML for the main content column (paragraphs, etc.). */
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
  footer: string;
  ignore: string;
  appUrl?: string;
}

/** Shared Buy The Way transactional email shell used by invite + magic-link. */
export const renderBrandedEmailHtml = (input: BrandedEmailHtml): string => {
  const appUrl = input.appUrl ?? resolveAppUrl();
  const logoUrl = `${appUrl}/branding/logo-original.png`;
  return `<!doctype html>
<html lang="${input.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fcfbf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
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
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#1c1c1c;">${escapeHtml(input.greeting)}</h1>
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px;">
                <a
                  href="${input.ctaHref}"
                  style="display:inline-block;background:#113261;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:9999px;font-weight:600;font-size:16px;line-height:1;"
                >${escapeHtml(input.ctaLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;">
                <p style="margin:0;font-size:13px;line-height:1.55;color:#5f5f5d;">${escapeHtml(input.footer)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#9d9d9b;">${escapeHtml(input.ignore)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const joinPlainTextEmail = (lines: string[]): string => [...lines, '', '-- Buy The Way'].join('\n');
