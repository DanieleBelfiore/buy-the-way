#!/usr/bin/env node
/**
 * scripts/report-users.mjs
 *
 * READ-ONLY. Connects to production Firestore via the Admin SDK and produces a
 * self-contained, user-centric HTML dashboard: one row per user with their
 * profile, private state (lastLoginAt, onboarding, completed-shop counter),
 * owned/shared lists, catalog size, notification count, and a timeline of the
 * shopping runs they recorded.
 *
 * Usage:
 *   1. Authenticate once with Application Default Credentials (no key file):
 *        gcloud auth application-default login
 *        gcloud config set project buy-the-way-2ac6e
 *   2. Run:
 *        pnpm report:users
 *   3. Open the generated file (path printed at the end) in a browser.
 *
 * Safety rails:
 *  - Never writes. Only `.get()` reads are issued.
 *  - Admin SDK bypasses Firestore Rules, so this needs a Google identity with
 *    read access to the project (ADC). No service-account key is downloaded.
 *  - Output contains PII (emails, display names). It is written under
 *    scripts/out/ which is git-ignored. Do not commit or share it.
 *  - User-controlled strings (displayName, email, list names) are embedded as
 *    escaped JSON and rendered client-side via textContent, so a hostile value
 *    like `<script>` cannot execute when the file is opened.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const PROJECT_ID = 'buy-the-way-2ac6e';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested; no Firestore, no Node I/O).
// ---------------------------------------------------------------------------

/**
 * Join the six raw snapshots into a sorted, per-user report array.
 * @param {object} raw
 * @param {Array<{uid:string,email:string,displayName:string,photoURL?:string}>} raw.users
 * @param {Record<string, object>} raw.privateByUid
 * @param {Record<string, number>} raw.notificationsCountByUid
 * @param {Record<string, number>} raw.catalogCountByUid
 * @param {Array<{id:string,name:string,ownerUid:string,admins?:string[],collaboratorUids?:string[]}>} raw.lists
 * @param {Record<string, Array<{completedAt:number,itemCount:number,listId:string,trigger:string}>>} raw.historyByUid
 */
export function buildUserReports(raw) {
  const {
    users = [],
    privateByUid = {},
    notificationsCountByUid = {},
    catalogCountByUid = {},
    lists = [],
    historyByUid = {},
  } = raw;

  const listName = new Map(lists.map((l) => [l.id, l.name]));

  const reports = users.map((u) => {
    const priv = privateByUid[u.uid] ?? {};

    const ownedLists = [];
    const sharedLists = [];
    for (const l of lists) {
      const collaborators = l.collaboratorUids ?? [];
      const admins = l.admins ?? [l.ownerUid];
      if (l.ownerUid === u.uid) {
        ownedLists.push({ id: l.id, name: l.name });
      } else if (collaborators.includes(u.uid)) {
        const role = admins.includes(u.uid) ? 'admin' : 'collaborator';
        sharedLists.push({ id: l.id, name: l.name, role });
      }
    }

    const history = (historyByUid[u.uid] ?? [])
      .slice()
      .sort((a, b) => b.completedAt - a.completedAt);
    const completions = history.filter((h) => h.trigger === 'completion').length;
    const emptyFallbacks = history.filter((h) => h.trigger === 'empty_fallback').length;

    return {
      uid: u.uid,
      email: u.email ?? '',
      displayName: u.displayName ?? '',
      photoURL: u.photoURL ?? '',
      lastLoginAt: priv.lastLoginAt ?? null,
      onboardingSeen: priv.onboardingSeen ?? false,
      defaultListId: priv.defaultListId ?? null,
      // Prefer the authoritative private counter; fall back to counting the
      // recorded completion snapshots for users who predate the counter.
      completedShopCount: priv.completedShopCount ?? completions ?? 0,
      lastCompletedShopAt: priv.lastCompletedShopAt ?? undefined,
      catalogSize: catalogCountByUid[u.uid] ?? 0,
      notifications: notificationsCountByUid[u.uid] ?? 0,
      completions,
      emptyFallbacks,
      ownedLists,
      sharedLists,
      shopTimeline: history.slice(0, 20).map((h) => ({
        completedAt: h.completedAt,
        itemCount: h.itemCount,
        listName: listName.get(h.listId) ?? h.listId,
        trigger: h.trigger,
      })),
    };
  });

  reports.sort((a, b) => {
    const av = a.lastLoginAt ?? -Infinity;
    const bv = b.lastLoginAt ?? -Infinity;
    return bv - av;
  });

  return reports;
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
 * Render a self-contained HTML dashboard string from the reports.
 * @param {ReturnType<typeof buildUserReports>} reports
 * @param {{projectId:string, generatedAt:number}} meta
 */
export function renderDashboard(reports, meta) {
  const dataJson = toSafeJson(reports);
  const metaJson = toSafeJson(meta);
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>buy-the-way - user report (${meta.projectId})</title>
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
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: #161a22; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px;
          background: #1d2430; color: #9fb4d6; }
  .detail td { background: #0c0e12; padding: 0; }
  .card { padding: 14px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .kv b { display: block; color: #8b93a1; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .lists, .timeline { grid-column: 1 / -1; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .empty { padding: 40px; text-align: center; color: #8b93a1; }
</style>
</head>
<body>
<header>
  <h1>User report</h1>
  <span class="muted" id="meta"></span>
  <input id="q" type="search" placeholder="Filtra per email o nome...">
</header>
<table>
  <thead><tr>
    <th data-k="email">Email</th>
    <th data-k="displayName">Nome</th>
    <th data-k="lastLoginAt" class="num">Ultimo login</th>
    <th data-k="completedShopCount" class="num">Spese</th>
    <th data-k="listCount" class="num">Liste</th>
    <th data-k="catalogSize" class="num">Catalogo</th>
    <th data-k="notifications" class="num">Notifiche</th>
  </tr></thead>
  <tbody id="rows"></tbody>
</table>
<div class="empty" id="empty" hidden>Nessun utente.</div>
<script>
const DATA = ${dataJson};
const META = ${metaJson};
for (const r of DATA) r.listCount = r.ownedLists.length + r.sharedLists.length;

const fmtDate = (ms) => ms == null ? '-' : new Date(ms).toLocaleString();
const fmtRel = (ms) => {
  if (ms == null) return '-';
  const d = Math.floor((Date.now() - ms) / 86400000);
  if (d <= 0) return 'oggi';
  if (d === 1) return 'ieri';
  return d + 'g fa';
};
document.getElementById('meta').textContent =
  DATA.length + ' utenti - progetto ' + META.projectId + ' - generato ' + fmtDate(META.generatedAt);

let sortKey = 'lastLoginAt', sortDir = 'desc';
const rowsEl = document.getElementById('rows');
const emptyEl = document.getElementById('empty');

const td = (text, cls) => { const el = document.createElement('td'); if (cls) el.className = cls; el.textContent = text; return el; };

function detailCard(r) {
  const wrap = document.createElement('td');
  wrap.colSpan = 7;
  const card = document.createElement('div');
  card.className = 'card';
  const kv = (label, value) => {
    const d = document.createElement('div'); d.className = 'kv';
    const b = document.createElement('b'); b.textContent = label;
    const s = document.createElement('span'); s.textContent = value;
    d.append(b, s); return d;
  };
  card.append(
    kv('UID', r.uid),
    kv('Onboarding visto', r.onboardingSeen ? 'si' : 'no'),
    kv('Lista default', r.defaultListId || '-'),
    kv('Contatore spese', String(r.completedShopCount)),
    kv('Ultima spesa', fmtDate(r.lastCompletedShopAt)),
    kv('Snapshot completion / empty', r.completions + ' / ' + r.emptyFallbacks),
  );
  const listsBox = document.createElement('div'); listsBox.className = 'lists';
  const lb = document.createElement('b'); lb.textContent = 'Liste'; listsBox.appendChild(lb);
  const ul = document.createElement('ul');
  for (const l of r.ownedLists) { const li = document.createElement('li'); li.textContent = l.name + ' (owner)'; ul.appendChild(li); }
  for (const l of r.sharedLists) { const li = document.createElement('li'); li.textContent = l.name + ' (' + l.role + ')'; ul.appendChild(li); }
  if (!r.ownedLists.length && !r.sharedLists.length) { const li = document.createElement('li'); li.textContent = '-'; ul.appendChild(li); }
  listsBox.appendChild(ul);
  card.appendChild(listsBox);

  if (r.shopTimeline.length) {
    const tl = document.createElement('div'); tl.className = 'timeline';
    const tb = document.createElement('b'); tb.textContent = 'Timeline spese (ultime ' + r.shopTimeline.length + ')'; tl.appendChild(tb);
    const ul2 = document.createElement('ul');
    for (const e of r.shopTimeline) {
      const li = document.createElement('li');
      li.textContent = fmtDate(e.completedAt) + ' - ' + e.listName + ' - ' + e.itemCount + ' item (' + e.trigger + ')';
      ul2.appendChild(li);
    }
    tl.appendChild(ul2); card.appendChild(tl);
  }
  wrap.appendChild(card);
  return wrap;
}

function render() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  let rows = DATA.filter((r) =>
    !q || (r.email && r.email.toLowerCase().includes(q)) || (r.displayName && r.displayName.toLowerCase().includes(q)));
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
    tr.append(
      td(r.email || '-'),
      td(r.displayName || '-'),
      (() => { const c = td(fmtRel(r.lastLoginAt), 'num'); c.title = fmtDate(r.lastLoginAt); return c; })(),
      td(String(r.completedShopCount), 'num'),
      td(String(r.listCount), 'num'),
      td(String(r.catalogSize), 'num'),
      td(String(r.notifications), 'num'),
    );
    let open = false, detailRow = null;
    tr.addEventListener('click', () => {
      open = !open;
      if (open) { detailRow = document.createElement('tr'); detailRow.className = 'detail'; detailRow.appendChild(detailCard(r)); tr.after(detailRow); }
      else if (detailRow) { detailRow.remove(); detailRow = null; }
    });
    rowsEl.appendChild(tr);
  }

  for (const th of document.querySelectorAll('th')) {
    th.dataset.dir = th.dataset.k === sortKey ? sortDir : '';
  }
}

for (const th of document.querySelectorAll('th')) {
  th.addEventListener('click', () => {
    const k = th.dataset.k;
    if (k === sortKey) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = k; sortDir = k === 'email' || k === 'displayName' ? 'asc' : 'desc'; }
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

/** Parent-doc id two levels up (e.g. users/{uid}/private/state -> uid). */
const grandparentId = (docSnap) => docSnap.ref.parent.parent?.id;

async function fetchRaw(db) {
  const [usersSnap, listsSnap, privateSnap, notifSnap, entriesSnap, historySnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('lists').get(),
    db.collectionGroup('private').get(),
    db.collectionGroup('notifications').get(),
    db.collectionGroup('entries').get(),
    db.collectionGroup('history').get(),
  ]);

  const users = usersSnap.docs.map((d) => {
    const v = d.data();
    return { uid: d.id, email: v.email ?? '', displayName: v.displayName ?? '', photoURL: v.photoURL ?? '' };
  });

  const lists = listsSnap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      name: v.name ?? '(senza nome)',
      ownerUid: v.ownerUid,
      admins: v.admins ?? [v.ownerUid],
      collaboratorUids: v.collaboratorUids ?? [],
    };
  });

  const privateByUid = {};
  for (const d of privateSnap.docs) {
    const uid = grandparentId(d);
    if (uid) privateByUid[uid] = d.data();
  }

  const notificationsCountByUid = {};
  for (const d of notifSnap.docs) {
    const uid = grandparentId(d);
    if (uid) notificationsCountByUid[uid] = (notificationsCountByUid[uid] ?? 0) + 1;
  }

  const catalogCountByUid = {};
  for (const d of entriesSnap.docs) {
    const uid = grandparentId(d);
    if (uid) catalogCountByUid[uid] = (catalogCountByUid[uid] ?? 0) + 1;
  }

  const historyByUid = {};
  for (const d of historySnap.docs) {
    const v = d.data();
    const uid = v.recordedByUid;
    if (!uid) continue;
    (historyByUid[uid] ??= []).push({
      completedAt: v.completedAt ?? 0,
      itemCount: v.itemCount ?? 0,
      listId: d.ref.parent.parent?.id ?? v.listId ?? '',
      trigger: v.trigger ?? 'completion',
    });
  }

  const reads =
    usersSnap.size + listsSnap.size + privateSnap.size + notifSnap.size + entriesSnap.size + historySnap.size;

  return { users, lists, privateByUid, notificationsCountByUid, catalogCountByUid, historyByUid, reads };
}

async function main() {
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  console.log(yellow(`Reading production project ${PROJECT_ID} (read-only)...`));
  const raw = await fetchRaw(db);
  const reports = buildUserReports(raw);
  const html = renderDashboard(reports, { projectId: PROJECT_ID, generatedAt: Date.now() });

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'out');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'report-users.html');
  await writeFile(outPath, html, 'utf8');

  console.log(green(`\n✓ ${reports.length} users - ${raw.reads} document reads`));
  console.log(green(`✓ Dashboard written: ${outPath}`));
  console.log(dim('Open it in a browser. Contains PII - do not commit or share (scripts/out/ is git-ignored).'));
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  main().catch((err) => {
    console.error(`\x1b[31mreport-users failed: ${err?.message ?? err}\x1b[0m`);
    if (/could not load the default credentials|application default/i.test(String(err?.message))) {
      console.error('\x1b[2mRun: gcloud auth application-default login && gcloud config set project ' + PROJECT_ID + '\x1b[0m');
    }
    process.exit(1);
  });
}
