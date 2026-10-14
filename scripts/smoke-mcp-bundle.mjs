#!/usr/bin/env node
/**
 * Smoke test for the built /mcp function (netlify/functions/mcp/mcp.mjs).
 *
 * Unit and integration tests import the TypeScript sources; this imports the
 * exact bundle that ships, in plain Node, and answers two requests that need
 * no backend. It catches the class of bug that only shows up in deploy logs:
 * an import-time crash of the bundle (see .claude/docs/firebase.md, the
 * firebase-admin 14 and jose incidents). Run after `pnpm build:mcp`.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const bundle = resolve(process.cwd(), 'netlify/functions/mcp/mcp.mjs');
const fail = (msg) => {
  console.error(`[smoke-mcp] FAIL: ${msg}`);
  process.exit(1);
};

const { default: handler } = await import(pathToFileURL(bundle).href).catch((err) =>
  fail(`bundle does not import: ${err?.stack ?? err}`),
);
if (typeof handler !== 'function') fail('default export is not a function');

const preflight = await handler(new Request('https://app.example/mcp', { method: 'OPTIONS' }), {});
if (preflight.status !== 204) fail(`OPTIONS answered ${preflight.status}, expected 204`);

const anon = await handler(new Request('https://app.example/mcp', { method: 'POST', body: '{}' }), {});
const challenge = anon.headers.get('WWW-Authenticate') ?? '';
if (anon.status !== 401 || !challenge.includes('resource_metadata=')) {
  fail(`unauthenticated POST answered ${anon.status} "${challenge}", expected 401 with resource_metadata`);
}

console.log(`[smoke-mcp] OK on Node ${process.versions.node}: bundle imports, OPTIONS 204, anonymous POST 401`);
