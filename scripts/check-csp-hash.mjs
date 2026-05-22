#!/usr/bin/env node
// Verifies the sha256 hash recorded in netlify.toml's `script-src` directive
// matches the actual body of every inline <script> in index.html. CSP would
// silently block any inline script whose hash isn't in the allowlist, so this
// script is wired into CI to catch drift before deploy.
//
// Invoked as `pnpm csp:hash` locally and as a quality-gate step in ci-cd.yml.
// Exits non-zero with a clear diff if the hashes don't align.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HTML_PATH = resolve(ROOT, 'index.html');
const TOML_PATH = resolve(ROOT, 'netlify.toml');

function extractInlineScriptHashes(html) {
  // Strip HTML comments first so any literal `<script>` text inside them
  // (e.g. warning notes) doesn't confuse the tag regex below.
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = /<script>([\s\S]*?)<\/script>/g;
  const hashes = [];
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const body = m[1];
    const hash = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push({ body, token: `sha256-${hash}` });
  }
  return hashes;
}

function extractAllowedHashes(toml) {
  const directive = toml.match(/script-src[^;]*;/);
  if (!directive) {
    throw new Error('Could not find `script-src` directive in netlify.toml');
  }
  const tokens = directive[0].match(/sha256-[A-Za-z0-9+/=]+/g) ?? [];
  return new Set(tokens.map((t) => `'${t}'`.replace(/^'|'$/g, '')));
}

const html = readFileSync(HTML_PATH, 'utf8');
const toml = readFileSync(TOML_PATH, 'utf8');

const scripts = extractInlineScriptHashes(html);
if (scripts.length === 0) {
  console.log('No inline <script> blocks in index.html — nothing to check.');
  process.exit(0);
}

const allowed = extractAllowedHashes(toml);

let drifted = false;
for (const { token, body } of scripts) {
  const ok = allowed.has(token);
  const preview = body.trim().split('\n')[0]?.slice(0, 60) ?? '';
  if (ok) {
    console.log(`OK   ${token}  (${preview}…)`);
  } else {
    drifted = true;
    console.error(`DRIFT ${token}  (${preview}…)`);
  }
}

if (drifted) {
  console.error('\nOne or more inline scripts in index.html have hashes that');
  console.error('are NOT present in netlify.toml `script-src`. Update the');
  console.error('allowlist with the sha256-… token(s) printed above.\n');
  process.exit(1);
}

console.log('\nAll inline-script hashes match netlify.toml.');
