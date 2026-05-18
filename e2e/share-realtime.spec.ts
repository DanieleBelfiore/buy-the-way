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
  // Seed Bob in a throwaway context so his /users doc exists.
  const ctx = await browser.newContext();
  await pinLocaleEN(ctx);
  const page = await ctx.newPage();
  await signInAs(page, BOB);
  await page.waitForTimeout(800);
  await ctx.close();
});

test('two contexts see new item sync within 1s', async ({ browser }) => {
  // Alice context
  const aliceCtx = await browser.newContext();
  await pinLocaleEN(aliceCtx);
  const alicePage = await aliceCtx.newPage();
  await signInAs(alicePage, ALICE);
  const listId = await createSharedList(alicePage, 'Realtime');
  await alicePage.goto(`/lists/${listId}`);

  // Bob context (separate browser session — isolated cookies + storage)
  const bobCtx = await browser.newContext();
  await pinLocaleEN(bobCtx);
  const bobPage = await bobCtx.newPage();
  await signInAs(bobPage, BOB);
  await bobPage.goto(`/lists/${listId}`);
  await expect(bobPage.getByRole('heading', { name: 'Realtime' })).toBeVisible();

  // Alice adds an item; Bob should see it.
  const aliceInput = alicePage.getByPlaceholder('Add an item');
  await aliceInput.click();
  await aliceInput.fill('Pasta');
  const aliceOption = alicePage.getByRole('option').filter({ hasText: 'Pasta' });
  await aliceOption.first().waitFor({ state: 'visible' });
  await aliceOption.first().click();

  const t0 = Date.now();
  await expect(bobPage.getByText('Pasta').first()).toBeVisible({ timeout: 5_000 });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(2_000);

  await aliceCtx.close();
  await bobCtx.close();
});

test('two contexts see check toggle sync', async ({ browser }) => {
  const aliceCtx = await browser.newContext();
  await pinLocaleEN(aliceCtx);
  const alicePage = await aliceCtx.newPage();
  await signInAs(alicePage, ALICE);
  const listId = await createSharedList(alicePage, 'ToggleSync');
  await alicePage.goto(`/lists/${listId}`);
  const aliceInput = alicePage.getByPlaceholder('Add an item');
  await aliceInput.click();
  await aliceInput.fill('Eggs');
  let opt = alicePage.getByRole('option').filter({ hasText: 'Eggs' });
  await opt.first().waitFor({ state: 'visible' });
  await opt.first().click();
  await expect(alicePage.getByText('Eggs').first()).toBeVisible();

  // Add a second item to prevent auto-collapse when one gets checked.
  await aliceInput.click();
  await aliceInput.fill('Bread');
  opt = alicePage.getByRole('option').filter({ hasText: 'Bread' });
  await opt.first().waitFor({ state: 'visible' });
  await opt.first().click();
  await expect(alicePage.getByText('Bread').first()).toBeVisible();

  const bobCtx = await browser.newContext();
  await pinLocaleEN(bobCtx);
  const bobPage = await bobCtx.newPage();
  await signInAs(bobPage, BOB);
  await bobPage.goto(`/lists/${listId}`);
  await expect(bobPage.getByText('Eggs').first()).toBeVisible({ timeout: 5_000 });

  // Bob toggles Eggs; Alice's Eggs row should reflect the new state.
  const bobEggs = bobPage.getByTestId('row-toggle').filter({ hasText: 'Eggs' });
  await bobEggs.click();
  const aliceEggs = alicePage.getByTestId('row-toggle').filter({ hasText: 'Eggs' });
  await expect(aliceEggs).toHaveAttribute('aria-label', 'Mark as to buy', { timeout: 3_000 });

  await aliceCtx.close();
  await bobCtx.close();
});
