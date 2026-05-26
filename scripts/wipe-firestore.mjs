#!/usr/bin/env node
/**
 * scripts/wipe-firestore.mjs
 *
 * Destructive: deletes every document in the production Firestore database
 * (users, lists, catalog, rateLimits) and all objects in the Firebase Storage
 * bucket. Auth users, Firestore Rules, indexes, and Netlify deploys are NOT
 * touched.
 *
 * Usage: `pnpm firebase:wipe:prod`
 *
 * Safety rails:
 *  1. Requires Firebase CLI installed and `firebase login` already done.
 *  2. Storage wipe requires gsutil (Google Cloud SDK).
 *  3. Prompts twice - once for confirmation, once to retype the project ID.
 *  4. Streams deletes per top-level collection so a Ctrl-C mid-run leaves a
 *     partially-wiped database (which is fine - restart resumes).
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const PROJECT_ID = 'buy-the-way-2ac6e';
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const STORAGE_GS_URI = `gs://${STORAGE_BUCKET}`;
const COLLECTIONS = ['users', 'lists', 'catalog', 'rateLimits'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const runCommand = (cmd, args) =>
  new Promise((resolve, reject) => {
    let stderr = '';
    const child = spawn(cmd, args, {
      stdio: ['inherit', 'inherit', 'pipe'],
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }
      reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
    child.on('error', reject);
  });

const runFirebase = (args) => runCommand('firebase', args);

const isStorageAlreadyEmpty = (message) =>
  /matched no objects|No URLs matched/i.test(message);

const wipeStorage = async () => {
  console.log(yellow(`\n→ Deleting all objects in ${STORAGE_GS_URI}…`));
  try {
    await runCommand('gsutil', ['-m', 'rm', '-r', `${STORAGE_GS_URI}/**`]);
    console.log(green('✓ Storage wiped'));
  } catch (err) {
    if (isStorageAlreadyEmpty(err.message)) {
      console.log(dim('Storage already empty.'));
      return;
    }
    throw err;
  }
};

const main = async () => {
  const rl = createInterface({ input, output });

  console.log(red('\n⚠️  WIPE PRODUCTION DATA'));
  console.log(yellow(`Project: ${PROJECT_ID}`));
  console.log(yellow('Firestore collections that will be deleted (recursively):'));
  for (const c of COLLECTIONS) console.log(yellow(`  • ${c}`));
  console.log(yellow('\nStorage bucket that will be emptied:'));
  console.log(yellow(`  • ${STORAGE_GS_URI}`));
  console.log(dim('\nFirebase Auth users, Firestore Rules, and indexes are NOT touched.'));
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

  try {
    await wipeStorage();
  } catch (err) {
    console.error(red(`✗ Storage failed: ${err.message}`));
    console.log(dim('Firestore wipe finished. Fix gsutil/auth and re-run for Storage only if needed.'));
  }

  console.log(green('\n✓ Wipe complete.'));
  console.log(
    dim(
      `Verify Firestore: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data`,
    ),
  );
  console.log(
    dim(
      `Verify Storage: https://console.firebase.google.com/project/${PROJECT_ID}/storage/${STORAGE_BUCKET}/files`,
    ),
  );
};

main().catch((err) => {
  console.error(red(`\nUnexpected error: ${err.message}`));
  process.exit(1);
});
