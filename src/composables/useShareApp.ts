import { useI18n } from 'vue-i18n';

export interface ShareAppResult {
  /** True when the native share sheet (or clipboard fallback) succeeded. */
  ok: boolean;
  /** True when we used the clipboard fallback (caller can show a toast). */
  copied: boolean;
}

/**
 * Cross-platform "share the app" action.
 *
 * On mobile this opens the native share sheet (WhatsApp / Messages / etc.);
 * on desktop or platforms without `navigator.share`, copies the link to the
 * clipboard. User cancellation (AbortError) is treated as a no-op so callers
 * don't show a misleading toast.
 *
 * Returns a structured result so callers can decide whether to toast a
 * "link copied" message (only when we fell back to clipboard).
 */
export const useShareApp = () => {
  const { t } = useI18n();

  const shareApp = async (
    overrideMessage?: string,
  ): Promise<ShareAppResult> => {
    const url = window.location.origin;
    const title = 'Buy The Way';
    const text = overrideMessage ?? t('settings.shareMessage');
    const nav = window.navigator;

    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, text, url });
        return { ok: true, copied: false };
      } catch (err) {
        // User cancelled via the OS sheet — surface as no-op.
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { ok: false, copied: false };
        }
        // Any other Web Share error falls through to the clipboard path.
      }
    }

    try {
      await nav.clipboard.writeText(`${text} ${url}`);
      return { ok: true, copied: true };
    } catch {
      return { ok: false, copied: false };
    }
  };

  return { shareApp };
};
