import { describe, it, expect } from 'vitest';
// The script guards its main() behind a direct-execution check, so importing
// here is side-effect-free (no Firebase init, no filesystem reads). We only
// exercise the pure helpers: catalog-name parsing, aggregation, and safe HTML
// rendering.
import {
  buildCustomProductReport,
  renderDashboard
} from '../../../scripts/report-custom-products.mjs';

describe('report-custom-products buildCustomProductReport', () => {
  const publicNames = new Set(['mela', 'apple', 'pane', 'bread']);

  it('excludes names present in the public catalog', () => {
    const rows = buildCustomProductReport(
      [{ name: 'Mela', category: 'fruit_vegetables', ownerUid: 'u1', usageCount: 1, lastUsedAt: 1 }],
      publicNames,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('report-custom-products renderDashboard', () => {
  it('embeds row and meta data as script-safe JSON', () => {
    const rows = [
      { name: 'Kombucha', userCount: 2, totalUsageCount: 4, lastUsedAt: 200, categories: [] },
    ];
    const html = renderDashboard(rows, {
      projectId: 'buy-the-way-2ac6e',
      generatedAt: 123,
      totalEntries: 10,
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Kombucha');
    expect(html).toContain('buy-the-way-2ac6e');
  });

  it('escapes hostile product names so they cannot break out of the script tag', () => {
    const rows = [
      {
        name: '</script><img src=x onerror=alert(1)>',
        userCount: 1,
        totalUsageCount: 1,
        lastUsedAt: 1,
        categories: [],
      },
    ];
    const html = renderDashboard(rows, { projectId: 'p', generatedAt: 1, totalEntries: 1 });
    expect(html).not.toContain('</script><img');
  });
});
