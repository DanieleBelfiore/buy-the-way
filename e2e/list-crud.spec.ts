import { test, expect } from '@playwright/test';
import { resetEmulators } from './helpers/emulator';
import { ALICE, signInAs } from './helpers/auth';
import { pinLocaleEN } from './helpers/setup';
import { expectNoA11yIssues } from './helpers/axe';

test.beforeEach(async ({ context }) => {
  await resetEmulators();
  await pinLocaleEN(context);
});

const createList = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name })).toBeVisible();
};

const addItem = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
  const input = page.getByPlaceholder('Add an item');
  await input.click();
  await input.fill(name);
  // Wait for the listbox to populate (suggestion debounce ~120ms), then commit
  // by clicking the option containing the exact item name.
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const option = page.getByRole('option').filter({ hasText: name });
  await option.first().waitFor({ state: 'visible' });
  await option.first().click();
  await expect(page.getByText(name).first()).toBeVisible();
};

test('create → open → list visible', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Groceries' })).toBeVisible();
});

test('duplicate name blocked (case-insensitive)', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.getByRole('button', { name: 'New list' }).click();
  await page.getByPlaceholder('List name').fill('groceries');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('You already have a list with this name.')).toBeVisible();
});

test('open list → add item → check → reload preserved', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.getByRole('button', { name: 'Groceries' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);

  // Two items in the same category prevents auto-collapse after checking one.
  await addItem(page, 'Milk');
  await addItem(page, 'Yogurt');

  const milkRow = page.getByTestId('row-toggle').filter({ hasText: 'Milk' });
  await expect(milkRow).toHaveAttribute('aria-label', 'Mark as bought');
  await milkRow.click();
  await expect(milkRow).toHaveAttribute('aria-label', 'Mark as to buy');

  await page.reload();
  await expect(page.getByTestId('row-toggle').filter({ hasText: 'Milk' })).toHaveAttribute(
    'aria-label',
    'Mark as to buy',
  );
  // Stats reflect 1 bought of 2 items.
  await expect(page.getByTestId('stat-bought')).toContainText('1/2');
});

test('remove single item via confirm modal', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.getByRole('button', { name: 'Groceries' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  await addItem(page, 'Bread');

  await page.getByTestId('row-remove').first().click();
  await page.getByTestId('confirm-modal-confirm').click();

  await expect(page.getByText('Bread')).toHaveCount(0);
});

test('empty list removes all items', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.getByRole('button', { name: 'Groceries' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  await addItem(page, 'Milk');
  await addItem(page, 'Bread');

  await page.getByTestId('empty-list-button').click();
  await page.getByTestId('dual-choice-modal-left').click();

  await expect(page.getByText('No items yet')).toBeVisible();
});

test('axe: /lists clean', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await expectNoA11yIssues(page, '/lists');
});

test('axe: /lists/:id clean', async ({ page }) => {
  await signInAs(page, ALICE);
  await createList(page, 'Groceries');
  await page.getByRole('button', { name: 'Groceries' }).click();
  await page.waitForURL(/\/lists\/[^/]+$/);
  await addItem(page, 'Milk');
  await expectNoA11yIssues(page, '/lists/:id');
});
