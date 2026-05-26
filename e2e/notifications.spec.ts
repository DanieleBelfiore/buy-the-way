import { test, expect, type Page } from '@playwright/test';
import { resetEmulators } from './helpers/emulator';
import { ALICE, BOB, signInAs } from './helpers/auth';
import { pinLocaleEN } from './helpers/setup';

const createSharedList = async (page: Page, name: string): Promise<string> => {
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  const url = page.url();
  const id = url.split('/lists/')[1]!.replace(/\/.*$/, '');

  await page.getByTestId('open-list-settings').click();
  await page.waitForURL(/\/lists\/[^/]+\/settings$/);
  await page.getByPlaceholder('Email address').fill(BOB.email);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(BOB.displayName)).toBeVisible();
  return id;
};

test.beforeEach(async ({ browser }) => {
  await resetEmulators();
  const ctx = await browser.newContext();
  await pinLocaleEN(ctx);
  const page = await ctx.newPage();
  await signInAs(page, BOB);
  await page.waitForTimeout(800);
  await ctx.close();
});

test('Bob sees a badge when Alice adds an item; popover renders + clears it', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  await pinLocaleEN(aliceCtx);
  const alicePage = await aliceCtx.newPage();
  await signInAs(alicePage, ALICE);
  const listId = await createSharedList(alicePage, 'Spesa');
  await alicePage.goto(`/lists/${listId}`);

  const bobCtx = await browser.newContext();
  await pinLocaleEN(bobCtx);
  const bobPage = await bobCtx.newPage();
  await signInAs(bobPage, BOB);
  await bobPage.goto('/lists');
  await expect(bobPage.getByTestId('open-notifications')).toBeVisible();

  // Alice adds an item; the notify-list-event mock fans out a notification
  // doc into Bob's subcollection, which his realtime listener picks up.
  const aliceInput = alicePage.getByPlaceholder('Add an item');
  await aliceInput.click();
  await aliceInput.fill('Latte');
  const aliceOption = alicePage.getByRole('option').filter({ hasText: 'Latte' });
  await aliceOption.first().waitFor({ state: 'visible' });
  await aliceOption.first().click();

  await expect(bobPage.getByTestId('notifications-badge')).toBeVisible({ timeout: 5_000 });

  // Open the popover; the row should render and the badge should clear.
  await bobPage.getByTestId('open-notifications').click();
  await expect(bobPage.getByTestId('notifications-dialog')).toBeVisible();
  await expect(bobPage.getByTestId('notification-row').first()).toBeVisible();
  await expect(bobPage.getByTestId('notifications-badge')).toBeHidden();

  // Close the popover; once closed the empty state should appear on reopen.
  await bobPage.getByTestId('notifications-close').click();
  await expect(bobPage.getByTestId('notifications-dialog')).toBeHidden();
  await bobPage.getByTestId('open-notifications').click();
  await expect(bobPage.getByTestId('notifications-empty')).toBeVisible();

  await aliceCtx.close();
  await bobCtx.close();
});
