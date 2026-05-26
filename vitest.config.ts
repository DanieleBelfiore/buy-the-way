import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', 'dist', 'tests/rules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/main.ts',
        'src/pwa/**',
        // E2E-only module: loaded when VITE_E2E=true and exercised by Playwright,
        // never bundled in production. Out of scope for unit coverage.
        'src/e2e-bridge.ts',
        // Dev-only module: loaded when DEV && VITE_USE_EMULATOR=true so the
        // SPA can talk to /.netlify/functions/* without `netlify dev`. Hard
        // refuses to load outside dev (see file header). Out of scope for
        // unit coverage - exercised manually + via dev workflow.
        'src/dev-bridge.ts',
        // No runtime code - types only
        'src/domain/types.ts',
        // Side-effectful Firebase init, globally mocked in tests
        'src/services/firebase.ts',
        // Minimal wrapper - tested via router-view integration
        'src/App.vue',
        // Reads localStorage/navigator.language at module level; covered by SettingsView tests (Task 27)
        'src/i18n/index.ts',
        // Stub views implemented in later phases
        'src/views/ListDetailView.vue',
        'src/views/SettingsView.vue',
      ],
    },
  },
});
