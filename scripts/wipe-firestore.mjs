#!/usr/bin/env node
/**
 * scripts/wipe-firestore.mjs
 *
 * Destructive: deletes every document in the production Firestore database
 * (lists, items, catalog, users). Auth users, Firestore Rules, indexes,
 * Storage, and Netlify deploys are NOT touched.
 *
 * Usage: `pnpm firebase:wipe:prod`
 *
 * Safety rails:
 *  1. Requires Firebase CLI installed and `firebase login` already done.
 *  2. Prompts twice — once for confirmation, once to retype the project ID.
 *  3. Streams deletes per top-level collection so a Ctrl-C mid-run leaves a
 *     partially-wiped database (which is fine — restart resumes).
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const PROJECT_ID = 'buy-the-way-2ac6e';
const COLLECTIONS = ['users', 'lists', 'catalog'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const runFirebase = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn('firebase', args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`firebase ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });

const main = async () => {
  const rl = createInterface({ input, output });

  console.log(red('\n⚠️  WIPE FIRESTORE — PRODUCTION'));
  console.log(yellow(`Project: ${PROJECT_ID}`));
  console.log(yellow(`Collections that will be deleted (recursively):`));
  for (const c of COLLECTIONS) console.log(yellow(`  • ${c}`));
  console.log(dim('\nFirebase Auth users, Firestore Rules, indexes, and Storage are NOT touched.'));
  console.log(dim('This action is irreversible. Make sure you have a backup if you need one.\n'));

  const confirm = await rl.question(red('Type "wipe" to confirm: '));
  if (confirm.trim().toLowerCase() !== 'wipe') {
    console.log(dim('Aborted.'));
    rl.close();
    process.exit(0);
  }

  const projectConfirm = await rl.question(
    red(`Retype the project ID exactly (${PROJECT_ID}): `),
  );
  if (projectConfirm.trim() !== PROJECT_ID) {
    console.log(dim('Project ID mismatch. Aborted.'));
    rl.close();
    process.exit(0);
  }
  rl.close();

  console.log(yellow('\nStarting wipe…\n'));

  // Delete each collection separately so a failure on one doesn't abort the
  // rest, and so progress is visible per collection.
  for (const c of COLLECTIONS) {
    console.log(yellow(`\n→ Deleting ${c}/…`));
    try {
      await runFirebase([
        'firestore:delete',
        c,
        '--recursive',
        '--project',
        PROJECT_ID,
        '--force',
      ]);
      console.log(green(`✓ ${c}/ wiped`));
    } catch (err) {
      console.error(red(`✗ ${c}/ failed: ${err.message}`));
      console.log(dim('Continuing with the next collection. Re-run the script later for the failed one.'));
    }
  }

  console.log(green('\n✓ Wipe complete.'));
  console.log(
    dim(
      `Verify: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data`,
    ),
  );
};

main().catch((err) => {
  console.error(red(`\nUnexpected error: ${err.message}`));
  process.exit(1);
});
