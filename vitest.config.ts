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
        // No runtime code — types only
        'src/domain/types.ts',
        // Side-effectful Firebase init, globally mocked in tests
        'src/services/firebase.ts',
        // Minimal wrapper — tested via router-view integration
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
