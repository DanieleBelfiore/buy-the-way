import type { BrowserContext } from '@playwright/test';

/**
 * Pin locale to English so specs match English-labelled UI strings.
 * Apply via context.addInitScript before any page navigation.
 */
export const pinLocaleEN = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('locale', 'en');
    } catch {
      // ignored
    }
  });
};
