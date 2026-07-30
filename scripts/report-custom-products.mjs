#!/usr/bin/env node
/**
 * scripts/report-custom-products.mjs
 *
 * READ-ONLY. Connects to production Firestore via the Admin SDK and produces a
 * self-contained HTML dashboard of "custom products" - catalog entries users
 * typed that do NOT match an item in the static public catalog
 * (src/domain/public-catalog.ts). Grouped by normalized name across all users,
 * so it's easy to see which custom products are common enough to promote into
 * the standard catalog.
 *
 * Usage:
 *   1. Authenticate once with Application Default Credentials (no key file):
 *        gcloud auth application-default login
 *        gcloud config set project buy-the-way-2ac6e
 *   2. Run:
 *        pnpm report:custom-products
 *   3. Open the generated file (path printed at the end) in a browser.
 *
 * Safety rails:
 *  - Never writes. Only `.get()` reads are issued.
 *  - Admin SDK bypasses Firestore Rules, so this needs a Google identity with
 *    read access to the project (ADC). No service-account key is downloaded.
 *  - Output contains no emails/display names, only uid counts and product
 *    names/categories. Still written under scripts/out/ (git-ignored) since
 *    product names typed by users are technically user-generated content.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const PROJECT_ID = 'buy-the-way-2ac6e';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no Firestore, no Node I/O).
// ---------------------------------------------------------------------------

/** Mirrors src/domain/public-catalog.ts normalizeName - keep in sync. */
export const normalizeName = (name) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/**
 * Parse `name_it`/`name_en` pairs out of the PUBLIC_CATALOG literal in
 * src/domain/public-catalog.ts without compiling TypeScript. The file is a
 * flat array of single-line `{ slug: '...', name_it: '...', name_en: '...', ... }`
 * entries (enforced by prettier), so a line-scoped regex is reliable and avoids
 * pulling a TS loader into a plain-node script.
 * @param {string} source
 */
export function extractPublicCatalogNames(source) {
  const names = new Set();
  const entryRe = /name_it:\s*'([^']*)'|name_en:\s*'([^']*)'/g;
  for (const line of source.split('\n')) {
    if (!line.includes('name_it')) continue;
    entryRe.lastIndex = 0;
    let m;
    while ((m = entryRe.exec(line))) {
      const value = m[1] ?? m[2];
      if (value) names.add(normalizeName(value));
    }
  }
  return names;
}

/**
 * Group raw per-user catalog entries into per-product rows, keeping only
 * names absent from the public catalog.
 * @param {Array<{name:string, category:string, ownerUid:string, usageCount:number, lastUsedAt:number}>} entries
 * @param {Set<string>} publicNames
 */
export function buildCustomProductReport(entries, publicNames) {
  const byNormalized = new Map();

  for (const e of entries) {
    const key = normalizeName(e.name);
    if (!key || publicNames.has(key)) continue;

    let row = byNormalized.get(key);
    if (!row) {
      row = {
        name: e.name,
        categories: new Map(),
        owners: new Set(),
        totalUsageCount: 0,
        lastUsedAt: 0,
      };
      byNormalized.set(key, row);
    }
    // Prefer the longest raw name as display label (usually the most complete casing).
    if (e.name.length > row.name.length) row.name = e.name;
    row.categories.set(e.category, (row.categories.get(e.category) ?? 0) + 1);
    row.owners.add(e.ownerUid);
    row.totalUsageCount += e.usageCount ?? 0;
    row.lastUsedAt = Math.max(row.lastUsedAt, e.lastUsedAt ?? 0);
  }

  const rows = [...byNormalized.values()].map((r) => ({
    name: r.name,
    userCount: r.owners.size,
    totalUsageCount: r.totalUsageCount,
    lastUsedAt: r.lastUsedAt,
    categories: [...r.categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
  }));

  rows.sort((a, b) => b.userCount - a.userCount || b.totalUsageCount - a.totalUsageCount);
  return rows;
}

/** Embed data as JSON that is safe inside a <script> tag and inert if reflected. */
function toSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Render a self-contained HTML dashboard string from the report rows.
 * @param {ReturnType<typeof buildCustomProductReport>} rows
 * @param {{projectId:string, generatedAt:number, totalEntries:number}} meta
 */
export function renderDashboard(rows, meta) {
  const dataJson = toSafeJson(rows);
  const metaJson = toSafeJson(meta);
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>buy-the-way - custom products report (${meta.projectId})</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: #0f1115; color: #e6e6e6; }
  header { padding: 16px 20px; border-bottom: 1px solid #262a33; position: sticky; top: 0;
           background: #0f1115; display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
  h1 { font-size: 16px; margin: 0; }
  .muted { color: #8b93a1; font-size: 12px; }
  #q { margin-left: auto; padding: 7px 10px; min-width: 220px; border-radius: 8px;
       border: 1px solid #303642; background: #171a21; color: #e6e6e6; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #1d212a; white-space: nowrap; }
  th { position: sticky; top: 57px; background: #12151b; cursor: pointer; user-select: none; font-size: 12px;
       color: #aab2c0; }
  th[data-dir="asc"]::after { content: " \\2191"; }
  th[data-dir="desc"]::after { content: " \\2193"; }
  tbody tr:hover { background: #161a22; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px;
          background: #1d2430; color: #9fb4d6; margin-right: 4px; }
  .empty { padding: 40px; text-align: center; color: #8b93a1; }
</style>
</head>
<body>
<header>
  <h1>Custom products report</h1>
  <span class="muted" id="meta"></span>
  <input id="q" type="search" placeholder="Filtra per nome...">
</header>
<table>
  <thead><tr>
    <th data-k="name">Prodotto</th>
    <th data-k="userCount" class="num">Utenti</th>
    <th data-k="totalUsageCount" class="num">Utilizzi totali</th>
    <th data-k="lastUsedAt" class="num">Ultimo uso</th>
    <th>Categorie scelte</th>
  </tr></thead>
  <tbody id="rows"></tbody>
</table>
<div class="empty" id="empty" hidden>Nessun prodotto custom.</div>
<script>
const DATA = ${dataJson};
const META = ${metaJson};

const fmtDate = (ms) => ms == null || ms === 0 ? '-' : new Date(ms).toLocaleDateString();

document.getElementById('meta').textContent =
  DATA.length + ' prodotti custom distinti su ' + META.totalEntries + ' voci catalogo - progetto ' +
  META.projectId + ' - generato ' + new Date(META.generatedAt).toLocaleString();

let sortKey = 'userCount', sortDir = 'desc';
const rowsEl = document.getElementById('rows');
const emptyEl = document.getElementById('empty');

const td = (text, cls) => { const el = document.createElement('td'); if (cls) el.className = cls; el.textContent = text; return el; };

function render() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  let rows = DATA.filter((r) => !q || r.name.toLowerCase().includes(q));
  rows = rows.slice().sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'string' || typeof bv === 'string') {
      av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    av = av ?? -Infinity; bv = bv ?? -Infinity;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  rowsEl.textContent = '';
  emptyEl.hidden = rows.length > 0;
  for (const r of rows) {
    const tr = document.createElement('tr');
    const catsCell = document.createElement('td');
    for (const c of r.categories) {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = c.category + ' (' + c.count + ')';
      catsCell.appendChild(pill);
    }
    tr.append(
      td(r.name),
      td(String(r.userCount), 'num'),
      td(String(r.totalUsageCount), 'num'),
      td(fmtDate(r.lastUsedAt), 'num'),
      catsCell,
    );
    rowsEl.appendChild(tr);
  }

  for (const th of document.querySelectorAll('th')) {
    th.dataset.dir = th.dataset.k === sortKey ? sortDir : '';
  }
}

for (const th of document.querySelectorAll('th[data-k]')) {
  th.addEventListener('click', () => {
    const k = th.dataset.k;
    if (k === sortKey) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = k === 'name' ? 'asc' : 'desc'; }
    render();
  });
}
document.getElementById('q').addEventListener('input', render);
render();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// I/O (thin; not unit-tested - exercised against the live project).
// ---------------------------------------------------------------------------

async function fetchCatalogEntries(db) {
  const snap = await db.collectionGroup('entries').get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      name: v.name ?? '',
      category: v.category ?? 'other',
      ownerUid: v.ownerUid ?? d.ref.parent.parent?.id ?? '',
      usageCount: v.usageCount ?? 0,
      lastUsedAt: v.lastUsedAt ?? 0,
    };
  });
}

async function main() {
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const publicCatalogSource = await readFile(
    resolve(scriptsDir, '..', 'src', 'domain', 'public-catalog.ts'),
    'utf8',
  );
  const publicNames = extractPublicCatalogNames(publicCatalogSource);

  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  console.log(yellow(`Reading production project ${PROJECT_ID} (read-only)...`));
  const entries = await fetchCatalogEntries(db);
  const rows = buildCustomProductReport(entries, publicNames);
  const html = renderDashboard(rows, {
    projectId: PROJECT_ID,
    generatedAt: Date.now(),
    totalEntries: entries.length,
  });

  const outDir = resolve(scriptsDir, 'out');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'report-custom-products.html');
  await writeFile(outPath, html, 'utf8');

  console.log(green(`\n✓ ${rows.length} distinct custom products - ${entries.length} catalog entries read`));
  console.log(green(`✓ Dashboard written: ${outPath}`));
  console.log(dim('Open it in a browser. scripts/out/ is git-ignored.'));
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  main().catch((err) => {
    console.error(`\x1b[31mreport-custom-products failed: ${err?.message ?? err}\x1b[0m`);
    if (/could not load the default credentials|application default/i.test(String(err?.message))) {
      console.error('\x1b[2mRun: gcloud auth application-default login && gcloud config set project ' + PROJECT_ID + '\x1b[0m');
    }
    process.exit(1);
  });
}
