import type { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  displayName: string;
}

export const ALICE: TestUser = { email: 'alice@e2e.test', displayName: 'Alice E2E' };
export const BOB: TestUser = { email: 'bob@e2e.test', displayName: 'Bob E2E' };

const waitForBridge = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => Boolean(window.__btw), null, { timeout: 10_000 });
};

/**
 * Sign in via the e2e bridge (skips the Google popup).
 * Lands on `/lists` once the auth state propagates.
 */
export const signInAs = async (page: Page, user: TestUser): Promise<string> => {
  await page.goto('/login');
  await waitForBridge(page);
  const uid = await page.evaluate(
    async ({ email, displayName }) => window.__btw!.signIn(email, displayName),
    user,
  );
  await page.waitForURL('**/lists', { timeout: 10_000 });
  return uid;
};

export const signOut = async (page: Page): Promise<void> => {
  await waitForBridge(page);
  await page.evaluate(() => window.__btw!.signOut());
};
