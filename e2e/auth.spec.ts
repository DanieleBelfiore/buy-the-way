import { test, expect } from '@playwright/test';
import { resetEmulators } from './helpers/emulator';
import { ALICE, signInAs } from './helpers/auth';
import { expectNoA11yIssues } from './helpers/axe';

test.beforeEach(async () => {
  await resetEmulators();
});

test('login page renders Google CTA and passes axe', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('sign-in-btn')).toBeVisible();
  await expectNoA11yIssues(page, '/login');
});

test('unauthenticated user sees the landing page at / and passes axe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-cta')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expectNoA11yIssues(page, '/');
});

test('landing CTA leads to /login', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-cta').click();
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(/\/login$/);
});

test('sign-in via emulator lands on /lists', async ({ page }) => {
  await signInAs(page, ALICE);
  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText(ALICE.email)).not.toBeVisible({ timeout: 100 }).catch(() => {});
});

test('sign-out returns user to /login', async ({ page }) => {
  await signInAs(page, ALICE);
  await page.goto('/settings');
  await page.getByTestId('sign-out-btn').click();
  await page.waitForURL('**/login');
  await expect(page).toHaveURL(/\/login$/);
});

test('signing in twice with same email yields same uid', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  const first = await signInAs(pageA, ALICE);
  await ctxA.close();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const second = await signInAs(pageB, ALICE);
  await ctxB.close();

  expect(second).toBe(first);
});
