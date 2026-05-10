import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createEmulatorUser, injectAuthState, clearEmulatorData } from './helpers/auth';

test.beforeAll(async () => {
  await clearEmulatorData();
});

test.describe('List CRUD', () => {
  test('FAB opens new-list sheet', async ({ page }) => {
    const user = await createEmulatorUser('list-crud@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await expect(page.getByTestId('new-list-input')).toBeVisible();
  });

  test('creates a new list and navigates to detail', async ({ page }) => {
    const user = await createEmulatorUser('list-create@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Spesa settimanale');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-view="ListDetailView"]')).toBeVisible({ timeout: 5_000 });
  });

  test('list detail shows autocomplete shelf', async ({ page }) => {
    const user = await createEmulatorUser('list-detail@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Test List');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('autocomplete')).toBeVisible({ timeout: 5_000 });
  });

  test('navigates to list settings', async ({ page }) => {
    const user = await createEmulatorUser('list-settings@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('Settings Test');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    await page.locator('a[href*="settings"]').first().click();
    await expect(page.locator('[data-view="ListSettingsView"]')).toBeVisible({ timeout: 5_000 });
  });

  test('list detail has no accessibility violations', async ({ page }) => {
    const user = await createEmulatorUser('list-a11y@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    await page.getByTestId('new-list-fab').click();
    await page.getByTestId('new-list-input').fill('A11y List');
    await page.keyboard.press('Enter');
    await page.locator('[data-view="ListDetailView"]').waitFor({ timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
