import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createEmulatorUser, injectAuthState, clearEmulatorData } from './helpers/auth';

test.beforeAll(async () => {
  await clearEmulatorData();
});

test.describe('Auth flow', () => {
  test('unauthenticated root redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders Google CTA', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('google-cta')).toBeVisible();
  });

  test('login page has no accessibility violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('lang toggle switches locale label', async ({ page }) => {
    await page.goto('/login');
    const toggle = page.getByTestId('lang-toggle');
    const before = await toggle.textContent();
    await toggle.click();
    const after = await toggle.textContent();
    expect(after).not.toBe(before);
  });

  test('authenticated user lands on lists view', async ({ page }) => {
    const user = await createEmulatorUser('auth-test@example.com');
    await injectAuthState(page, user);
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-view="ListsView"]')).toBeVisible();
  });

  test('lists view has no accessibility violations', async ({ page }) => {
    const user = await createEmulatorUser('auth-a11y@example.com');
    await injectAuthState(page, user);
    await page.waitForURL('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });
});
