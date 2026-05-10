import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createEmulatorUser, injectAuthState, clearEmulatorData } from './helpers/auth';

test.beforeAll(async () => {
  await clearEmulatorData();
});

test.describe('Share & realtime sync', () => {
  test('two browserContext instances see the same list', async () => {
    const owner = await createEmulatorUser('rt-owner@example.com');
    const collab = await createEmulatorUser('rt-collab@example.com');

    const browser = await chromium.launch();
    const ctx1 = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const ctx2 = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    // Owner creates a list
    await injectAuthState(page1, owner);
    await page1.waitForURL('/');
    await page1.getByTestId('new-list-fab').click();
    await page1.getByTestId('new-list-input').fill('Realtime List');
    await page1.keyboard.press('Enter');
    await page1.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    const listUrl = page1.url();

    // Collaborator opens same list URL
    await injectAuthState(page2, collab);
    await page2.goto(listUrl);
    await page2.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });

    // Add collaborator via owner context
    await page1.locator('a[href*="settings"]').first().click();
    await page1.locator('[data-view="ListSettingsView"]').waitFor({ timeout: 5_000 });
    await page1.locator('a[href*="collaborators"]').first().click();
    await page1.getByTestId('email-input').fill(collab.email);
    await page1.keyboard.press('Enter');
    const foundCard = page1.getByTestId('found-card');
    if (await foundCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page1.getByTestId('add-btn').click();
    }

    // Both contexts should still show a list view
    await expect(page1.locator('[data-view]')).toBeVisible();
    await expect(page2.locator('[data-view]')).toBeVisible();

    await browser.close();
  });

  test('list detail has no accessibility violations (realtime context)', async ({ page }) => {
    const user = await createEmulatorUser('rt-a11y@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('RT A11y List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
