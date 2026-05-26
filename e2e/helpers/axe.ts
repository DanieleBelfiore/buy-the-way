import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const SEVERITY = new Set(['critical', 'serious']);
const THEME_STORAGE_KEY = 'btw:themeMode';

/** Internal: run axe once against whatever the current page looks like. */
const runAxe = async (page: Page, label: string): Promise<void> => {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const serious = result.violations.filter((v) => v.impact && SEVERITY.has(v.impact));
  if (serious.length > 0) {
    const summary = serious
      .map((v) => {
        const nodes = v.nodes
          .map((n) => `      • ${n.target.join(' ')}\n        ${n.failureSummary?.replace(/\n/g, '\n        ') ?? ''}`)
          .join('\n');
        return `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n${nodes}`;
      })
      .join('\n');
    throw new Error(
      `axe found ${serious.length} ${label} violations:\n${summary}`,
    );
  }
  expect(serious).toEqual([]);
};

/**
 * Switch the persisted theme then reload so the inline boot script applies
 * the new `data-theme` attribute on the first paint of the next page load.
 * Wait for `domcontentloaded` so the audit sees a stable DOM.
 */
const switchThemeAndReload = async (page: Page, theme: 'light' | 'dark'): Promise<void> => {
  await page.evaluate(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Storage unavailable - the inline script will fall back to light. */
      }
    },
    { key: THEME_STORAGE_KEY, value: theme },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
};

/**
 * Run axe-core against the current page under BOTH light and dark themes.
 * Reloads twice with the right localStorage value so the inline-boot script
 * applies the theme on first paint (no transient mismatch). Restores light
 * at the end so subsequent test assertions see the default state.
 *
 * Fails the test if any serious/critical WCAG violation is found in either
 * theme. The thrown error names the offending theme.
 */
export const expectNoA11yIssues = async (page: Page, label?: string): Promise<void> => {
  const base = label ?? 'page';

  // Light pass first - explicit even though it's the default, so we never
  // audit "whatever localStorage happened to be" from a previous test step.
  await switchThemeAndReload(page, 'light');
  await runAxe(page, `${base} (light)`);

  // Dark pass: the boot script reads localStorage before Vue mounts, so the
  // very first paint already carries data-theme="dark" and all components
  // render with the dark token values.
  await switchThemeAndReload(page, 'dark');
  await runAxe(page, `${base} (dark)`);

  // Leave the page in light mode for any further assertions in the test.
  await switchThemeAndReload(page, 'light');
};
