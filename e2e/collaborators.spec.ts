import { test, expect, type Browser } from '@playwright/test';
import { resetEmulators } from './helpers/emulator';
import { ALICE, BOB, signInAs } from './helpers/auth';
import { pinLocaleEN } from './helpers/setup';
import { expectNoA11yIssues } from './helpers/axe';

/**
 * Seed Bob's /users doc by signing him in once in a throwaway context.
 * Required because addCollaborator does an email lookup against /users.
 */
const seedUser = async (browser: Browser, user: typeof BOB): Promise<void> => {
  const ctx = await browser.newContext();
  await pinLocaleEN(ctx);
  const page = await ctx.newPage();
  await signInAs(page, user);
  // Let auth state listener flush the /users upsert before tearing down.
  await page.waitForTimeout(800);
  await ctx.close();
};

test.beforeEach(async ({ context }) => {
  await resetEmulators();
  await pinLocaleEN(context);
});

test('add collaborator: invalid email shows not-found', async ({ page }) => {
  await signInAs(page, ALICE);
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill('Family');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Family' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  await page.getByTestId('open-list-settings').click();
  await page.waitForURL(/\/lists\/[^/]+\/settings$/);

  await page.getByPlaceholder('Email address').fill('ghost@nowhere.test');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('No registered user with that email.')).toBeVisible();
});

test('share list with Bob: rename + leave + new-badge', async ({ browser }) => {
  await seedUser(browser, BOB);

  // Alice context: create list, share with Bob, rename.
  const aliceCtx = await browser.newContext();
  await pinLocaleEN(aliceCtx);
  const alicePage = await aliceCtx.newPage();
  await signInAs(alicePage, ALICE);
  await alicePage.getByRole('button', { name: 'New list' }).click();
  await alicePage.getByPlaceholder('List name').fill('Shared');
  await alicePage.getByRole('button', { name: 'Create', exact: true }).click();
  await alicePage.getByRole('button', { name: 'Shared' }).click();
  await alicePage.waitForURL(/\/lists\/[^/]+$/);
  await alicePage.getByTestId('open-list-settings').click();
  await alicePage.waitForURL(/\/lists\/[^/]+\/settings$/);

  await alicePage.getByPlaceholder('Email address').fill(BOB.email);
  await alicePage.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(alicePage.getByText(BOB.displayName)).toBeVisible();

  await alicePage.getByPlaceholder('New name').fill('Shared Renamed');
  await alicePage.getByTestId('rename-save').click();
  await alicePage.waitForTimeout(1000);
  // Navigate back to /lists to confirm rename was applied to the source-of-truth.
  await alicePage.goto('/lists');
  await expect(alicePage.getByRole('button', { name: 'Shared Renamed' })).toBeVisible();
  await aliceCtx.close();

  // Bob context: sees badge, opens, leaves.
  const bobCtx = await browser.newContext();
  await pinLocaleEN(bobCtx);
  const bobPage = await bobCtx.newPage();
  await signInAs(bobPage, BOB);
  await expect(bobPage.getByRole('button', { name: 'Shared Renamed' })).toBeVisible();
  await expect(bobPage.getByTestId('new-badge').first()).toBeVisible();

  await bobPage.getByRole('button', { name: 'Shared Renamed' }).click();
  await bobPage.waitForURL(/\/lists\/[^/]+$/);
  await bobPage.getByTestId('open-list-settings').click();
  await bobPage.waitForURL(/\/lists\/[^/]+\/settings$/);
  await bobPage.getByTestId('leave-list-bottom').click();
  await bobPage.waitForURL(/\/lists$/);
  await expect(bobPage.getByRole('button', { name: 'Shared Renamed' })).toHaveCount(0);
  await bobCtx.close();
});

test('axe: /lists/:id/settings clean', async ({ page }) => {
  await signInAs(page, ALICE);
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill('Family');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Family' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  await page.getByTestId('open-list-settings').click();
  await page.waitForURL(/\/lists\/[^/]+\/settings$/);
  await expectNoA11yIssues(page, '/lists/:id/settings');
});

test('axe: /settings clean', async ({ page }) => {
  await signInAs(page, ALICE);
  await page.goto('/settings');
  await expectNoA11yIssues(page, '/settings');
});
