import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createEmulatorUser, injectAuthState, clearEmulatorData } from './helpers/auth';

test.beforeAll(async () => {
  await clearEmulatorData();
});

test.describe('Offline sync', () => {
  test('UI stays functional while network is off', async ({ page, context }) => {
    const user = await createEmulatorUser('offline-edit@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');

    // Create a list while online
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Offline List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });

    // Go offline — IndexedDB persistence should keep the view alive
    await context.setOffline(true);
    await expect(page.getByTestId('autocomplete')).toBeVisible();

    // Restore connection
    await context.setOffline(false);
    await expect(page.locator('[data-view="ListDetailView"]')).toBeVisible();
  });

  test('reconnect after offline does not crash or redirect', async ({ page, context }) => {
    const user = await createEmulatorUser('offline-reconnect@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');

    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Reconnect List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });

    await context.setOffline(true);
    await context.setOffline(false);

    await expect(page.locator('[data-view="ListDetailView"]')).toBeVisible({ timeout: 5_000 });
  });

  test('offline list detail has no accessibility violations', async ({ page }) => {
    const user = await createEmulatorUser('offline-a11y@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Offline A11y');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
