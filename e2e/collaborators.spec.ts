import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createEmulatorUser, injectAuthState, clearEmulatorData } from './helpers/auth';

test.beforeAll(async () => {
  await clearEmulatorData();
});

test.describe('Collaborators', () => {
  test('add-collaborator view renders email input', async ({ page }) => {
    const owner = await createEmulatorUser('collab-owner@example.com');
    await injectAuthState(page, owner);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Shared List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="settings"]').first().click();
    await page.locator('[data-view="ListSettingsView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="collaborators"]').first().click();
    await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 5_000 });
  });

  test('searching known email shows found card', async ({ page }) => {
    await createEmulatorUser('collab-target@example.com');
    const owner = await createEmulatorUser('collab-search@example.com');
    await injectAuthState(page, owner);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Collab Search List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="settings"]').first().click();
    await page.locator('[data-view="ListSettingsView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="collaborators"]').first().click();
    await page.getByTestId('email-input').fill('collab-target@example.com');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('found-card')).toBeVisible({ timeout: 5_000 });
  });

  test('searching unknown email shows not-found card', async ({ page }) => {
    const owner = await createEmulatorUser('collab-notfound@example.com');
    await injectAuthState(page, owner);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('NotFound List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="settings"]').first().click();
    await page.locator('[data-view="ListSettingsView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="collaborators"]').first().click();
    await page.getByTestId('email-input').fill('nobody@nowhere.invalid');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('not-found-card')).toBeVisible({ timeout: 5_000 });
  });

  test('add-collaborator view has no accessibility violations', async ({ page }) => {
    const owner = await createEmulatorUser('collab-a11y@example.com');
    await injectAuthState(page, owner);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('A11y Collab');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="settings"]').first().click();
    await page.locator('[data-view="ListSettingsView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="collaborators"]').first().click();
    await page.locator('[data-view="AddCollaboratorView"]').waitFor({ timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
