import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/helpers/**'],
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 7_000,
    // Disable CSS transitions / @vueuse/motion variants so axe never reads
    // mid-fade computed colors. The app already honors prefers-reduced-motion
    // (App.vue view-fade + useLogoMotion).
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Firebase emulators are started by `pnpm test:e2e` via `firebase emulators:exec`,
  // which manages their lifecycle (incl. the Java child) and tears them down on exit.
  // Playwright only starts the Vite dev server here.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 60_000,
    env: {
      VITE_E2E: 'true',
      VITE_USE_EMULATOR: 'true',
      // Pin the emulator project id so the app and `firebase emulators:exec
      // --project=buy-the-way` (test:e2e script) agree. Without this the
      // emulator emits "Multiple projectIds" warnings and inter-context
      // realtime sync (Bob seeing Alice's writes) becomes inconsistent.
      VITE_FIREBASE_PROJECT_ID: 'buy-the-way',
      // Firebase SDK still calls initializeApp() before the emulator hook
      // kicks in, and it rejects an empty apiKey. In CI there's no .env.local
      // to supply the real values, so feed the SDK harmless placeholders -
      // every auth + firestore call gets rerouted to the local emulator the
      // moment connectAuthEmulator / connectFirestoreEmulator run anyway.
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
      VITE_FIREBASE_APP_ID: '1:1234567890:web:demo',
    },
  },
});
