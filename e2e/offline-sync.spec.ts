import { test, expect, type Page } from '@playwright/test';
import { resetEmulators } from './helpers/emulator';
import { ALICE, signInAs } from './helpers/auth';
import { pinLocaleEN } from './helpers/setup';

const addItem = async (page: Page, name: string): Promise<void> => {
  const input = page.getByPlaceholder('Add an item');
  await input.click();
  await input.fill(name);
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const option = page.getByRole('option').filter({ hasText: name });
  await option.first().waitFor({ state: 'visible' });
  await option.first().click();
};

test.beforeEach(async ({ context }) => {
  await resetEmulators();
  await pinLocaleEN(context);
});

test('add item while offline → reconnect → item persists', async ({ page, context }) => {
  await signInAs(page, ALICE);
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill('Offline');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Offline' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  const url = page.url();

  // Go offline; banner should appear.
  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible();

  await addItem(page, 'Olives');
  // Optimistic write — Firestore writes are queued by SDK; UI reflects via local cache.
  await expect(page.getByText('Olives').first()).toBeVisible();

  // Reconnect; item must still be there after a hard reload.
  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).not.toBeVisible();

  await page.goto(url);
  await expect(page.getByText('Olives').first()).toBeVisible({ timeout: 5_000 });
});

test('toggle item while offline → reconnect → state preserved', async ({ page, context }) => {
  await signInAs(page, ALICE);
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill('OfflineToggle');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'OfflineToggle' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);

  // Both items are dairy → same category, so toggling one won't auto-collapse it.
  await addItem(page, 'Cheese');
  await addItem(page, 'Yogurt');
  await expect(page.getByTestId('stat-items')).toContainText('2');

  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  const cheeseRow = page.getByTestId('row-toggle').filter({ hasText: 'Cheese' });
  await cheeseRow.click();
  await expect(cheeseRow).toHaveAttribute('aria-label', 'Mark as to buy', { timeout: 3_000 });
  await expect(page.getByTestId('stat-bought')).toContainText('1/2');

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('stat-bought')).toContainText('1/2', { timeout: 5_000 });
  await expect(page.getByTestId('row-toggle').filter({ hasText: 'Cheese' })).toHaveAttribute(
    'aria-label',
    'Mark as to buy',
  );
});
