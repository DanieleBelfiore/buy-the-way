import { describe, it, expect } from 'vitest';
// The script guards its main() behind a direct-execution check, so importing
// here is side-effect-free (no Firebase init, no filesystem reads). We only
// exercise the pure helpers: catalog-name parsing, aggregation, and safe HTML
// rendering.
import {
  normalizeName,
  extractPublicCatalogNames,
  buildCustomProductReport,
  renderDashboard,
} from '../../../scripts/report-custom-products.mjs';

describe('report-custom-products normalizeName', () => {
  it('lowercases, trims, and strips diacritics', () => {
    expect(normalizeName('  Pomodori  ')).toBe('pomodori');
    expect(normalizeName('Caffè')).toBe('caffe');
  });
});

describe('report-custom-products extractPublicCatalogNames', () => {
  it('extracts both name_it and name_en from single-line entries', () => {
    const source = `
export const PUBLIC_CATALOG = [
  { slug: 'mela', name_it: 'Mela', name_en: 'Apple', category: 'fruit_vegetables', icon: '🍎' },
  { slug: 'pane', name_it: 'Pane', name_en: 'Bread', category: 'bakery', icon: '🍞' },
];
`;
    const names = extractPublicCatalogNames(source);
    expect(names.has('mela')).toBe(true);
    expect(names.has('apple')).toBe(true);
    expect(names.has('pane')).toBe(true);
    expect(names.has('bread')).toBe(true);
    expect(names.size).toBe(4);
  });

  it('ignores unrelated lines', () => {
    const source = `export interface PublicCatalogEntry { readonly slug: string; }`;
    expect(extractPublicCatalogNames(source).size).toBe(0);
  });
});

describe('report-custom-products buildCustomProductReport', () => {
  const publicNames = new Set(['mela', 'apple', 'pane', 'bread']);

  it('excludes names present in the public catalog', () => {
    const rows = buildCustomProductReport(
      [{ name: 'Mela', category: 'fruit_vegetables', ownerUid: 'u1', usageCount: 1, lastUsedAt: 1 }],
      publicNames,
    );
    expect(rows).toHaveLength(0);
  });

  it('groups by normalized name across owners, case-insensitively', () => {
    const rows = buildCustomProductReport(
      [
        { name: 'Kombucha', category: 'other', ownerUid: 'u1', usageCount: 3, lastUsedAt: 100 },
        { name: 'kombucha', category: 'beverages', ownerUid: 'u2', usageCount: 1, lastUsedAt: 200 },
      ],
      publicNames,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].userCount).toBe(2);
    expect(rows[0].totalUsageCount).toBe(4);
    expect(rows[0].lastUsedAt).toBe(200);
  });

  it('tallies category choices per grouped product', () => {
    const rows = buildCustomProductReport(
      [
        { name: 'Kefir', category: 'dairy', ownerUid: 'u1', usageCount: 1, lastUsedAt: 1 },
        { name: 'Kefir', category: 'dairy', ownerUid: 'u2', usageCount: 1, lastUsedAt: 2 },
        { name: 'Kefir', category: 'beverages', ownerUid: 'u3', usageCount: 1, lastUsedAt: 3 },
      ],
      publicNames,
    );
    expect(rows[0].categories).toEqual([
      { category: 'dairy', count: 2 },
      { category: 'beverages', count: 1 },
    ]);
  });

  it('sorts by distinct-user count then usage count, descending', () => {
    const rows = buildCustomProductReport(
      [
        { name: 'Rare', category: 'other', ownerUid: 'u1', usageCount: 9, lastUsedAt: 1 },
        { name: 'Popular', category: 'other', ownerUid: 'u1', usageCount: 1, lastUsedAt: 1 },
        { name: 'Popular', category: 'other', ownerUid: 'u2', usageCount: 1, lastUsedAt: 1 },
      ],
      publicNames,
    );
    expect(rows.map((r) => r.name)).toEqual(['Popular', 'Rare']);
  });

  it('ignores entries with an empty name', () => {
    const rows = buildCustomProductReport(
      [{ name: '', category: 'other', ownerUid: 'u1', usageCount: 1, lastUsedAt: 1 }],
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
