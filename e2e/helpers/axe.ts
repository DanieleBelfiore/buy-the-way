import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const SEVERITY = new Set(['critical', 'serious']);

/**
 * Run axe-core against the current page and fail the test if any
 * serious/critical WCAG violation is found.
 */
export const expectNoA11yIssues = async (page: Page, label?: string): Promise<void> => {
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
      `axe found ${serious.length} ${label ?? 'page'} violations:\n${summary}`,
    );
  }
  expect(serious).toEqual([]);
};
