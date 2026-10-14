import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Builds the /mcp Netlify Function: netlify/mcp/handler.ts and the
 * src/services it calls, bundled for Node with `@/services/firebase` swapped
 * for netlify/mcp/firebase-node.ts. Run by `pnpm build:mcp` in the CI deploy
 * job, right before `netlify deploy`. See tasks/mcp-plan.md.
 *
 * Output goes to netlify/functions/mcp/ (gitignored): a function folder, so
 * no emitted file is mistaken for another function. firebase-admin stays
 * external like in every other function (netlify.toml): bundling it breaks
 * at import time.
 */

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Public Firebase web config, inlined from the same secrets the SPA build
// uses, so the function needs no extra Netlify env vars. Unset (local test
// runs) leaves the runtime process.env lookup in place.
const inline = (target: string, source: string): Record<string, string> => {
  const value = process.env[source];
  return value ? { [`process.env.${target}`]: JSON.stringify(value) } : {};
};

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/services\/firebase$/, replacement: r('./netlify/mcp/firebase-node.ts') },
      { find: '@', replacement: r('./src') },
    ],
  },
  define: {
    ...inline('FIREBASE_WEB_API_KEY', 'VITE_FIREBASE_API_KEY'),
    ...inline('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'),
    ...inline('FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'),
    ...inline('FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'),
  },
  ssr: { noExternal: true, external: ['firebase-admin'] },
  build: {
    ssr: r('./netlify/mcp/handler.ts'),
    outDir: r('./netlify/functions/mcp'),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    copyPublicDir: false,
    rollupOptions: {
      external: [/^firebase-admin(\/|$)/],
      output: { format: 'es', entryFileNames: 'mcp.mjs', inlineDynamicImports: true },
    },
  },
});
