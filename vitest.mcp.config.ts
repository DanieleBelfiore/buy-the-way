import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);

// Integration suite for the MCP server: runs src/services/* in plain Node
// against the Auth + Firestore + Storage emulators, with the real rules.
// `@/services/firebase` is swapped for the Node module the MCP function uses,
// so this proves the same wiring that ships. Run via `pnpm test:mcp`.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/services\/firebase$/,
        replacement: fileURLToPath(new URL('./netlify/mcp/firebase-node.ts', import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/mcp-integration/**/*.test.ts'],
    env: {
      FIREBASE_WEB_API_KEY: 'demo-api-key',
      FIREBASE_PROJECT_ID: 'demo-buy-the-way',
      FIREBASE_STORAGE_BUCKET: 'demo-buy-the-way.appspot.com',
    },
    // Node 25+ ships a global localStorage, on by default, that warns on
    // first touch (src/i18n reads it at import). The Lambda runtime has none,
    // so switching it off also matches production. Node 24 (CI) has it off
    // already and is not given the flag.
    execArgv: NODE_MAJOR >= 25 ? ['--no-experimental-webstorage'] : [],
    testTimeout: 20000,
    hookTimeout: 20000,
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
