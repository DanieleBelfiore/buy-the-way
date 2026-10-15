#!/usr/bin/env node
/**
 * scripts/drop-list-counters.mjs
 *
 * Removes the legacy `itemCount` / `urgentCount` fields from every
 * `lists/{id}` doc in production. The app no longer stores counts on the list
 * (they are derived from the item docs), so these fields are dead data that
 * only ever drifted. Nothing else on the list doc is touched.
 *
 * Usage:
 *   1. Authenticate once with Application Default Credentials (no key file):
 *        gcloud auth application-default login
 *        gcloud config set project buy-the-way-2ac6e
 *   2. Dry run (default, read-only): lists what would change.
 *        pnpm firebase:drop-list-counters
 *   3. Apply: asks you to retype the project ID, then writes.
 *        pnpm firebase:drop-list-counters --apply
 *
 * Safety rails:
 *  - Dry run unless `--apply` is passed, and `--apply` asks for the project ID.
 *  - Only `FieldValue.delete()` on the two counter fields, only on docs that
 *    hold at least one of them. Idempotent: re-running is safe.
 *  - Builds released before the change still increment the counters, so a
 *    field may reappear on a list used from an old installed PWA. Harmless
 *    (nothing reads it); run the script again once old builds are gone
 *    (tasks/drop-list-counters.md).
 *  - Cost: one read per list doc, one write per list that holds a counter.
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';

const PROJECT_ID = 'buy-the-way-2ac6e';
const BATCH_LIMIT = 500;

export const COUNTER_FIELDS = ['itemCount', 'urgentCount'];

/**
 * Lists that still hold a legacy counter, with the fields each one holds.
 * @param {Array<{id:string, ref:unknown, data:() => Record<string, unknown>}>} docs
 */
export function listsWithCounters(docs) {
  return docs
    .map((d) => ({ id: d.id, ref: d.ref, fields: COUNTER_FIELDS.filter((f) => f in d.data()) }))
    .filter((d) => d.fields.length > 0);
}

/**
 * Scan `lists` and, when `apply` is true, delete the counter fields in
 * batches of at most 500 writes.
 * @param {object} db admin Firestore (or a test double with collection/batch)
 * @param {{apply: boolean, deleteField: () => unknown}} opts
 */
export async function dropListCounters(db, { apply, deleteField }) {
  const snap = await db.collection('lists').get();
  const targets = listsWithCounters(snap.docs);
  if (!apply || targets.length === 0) {
    return { scanned: snap.size, withCounters: targets.length, updated: 0 };
  }

  let updated = 0;
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + BATCH_LIMIT);
    for (const t of chunk) {
      batch.update(t.ref, Object.fromEntries(t.fields.map((f) => [f, deleteField()])));
    }
    await batch.commit();
    updated += chunk.length;
  }
  return { scanned: snap.size, withCounters: targets.length, updated };
}

async function main() {
  const dim = (s) => `\x1b[2m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const apply = process.argv.includes('--apply');

  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  if (apply) {
    const rl = createInterface({ input, output });
    console.log(red(`\nRemoving ${COUNTER_FIELDS.join(' / ')} from every list in ${PROJECT_ID}.`));
    const answer = await rl.question(red(`Retype the project ID to confirm (${PROJECT_ID}): `));
    rl.close();
    if (answer.trim() !== PROJECT_ID) {
      console.log(dim('Project ID mismatch. Aborted, nothing written.'));
      return;
    }
  } else {
    console.log(yellow(`Dry run on ${PROJECT_ID} (read-only). Pass --apply to write.`));
  }

  const report = await dropListCounters(db, { apply, deleteField: () => FieldValue.delete() });
  console.log(green(`\n✓ ${report.scanned} lists scanned, ${report.withCounters} with legacy counters`));
  if (apply) console.log(green(`✓ ${report.updated} lists cleaned`));
  else if (report.withCounters > 0) console.log(dim('Run again with --apply to remove them.'));
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  main().catch((err) => {
    console.error(`\x1b[31mdrop-list-counters failed: ${err?.message ?? err}\x1b[0m`);
    if (/could not load the default credentials|application default/i.test(String(err?.message))) {
      console.error('\x1b[2mRun: gcloud auth application-default login && gcloud config set project ' + PROJECT_ID + '\x1b[0m');
    }
    process.exit(1);
  });
}
