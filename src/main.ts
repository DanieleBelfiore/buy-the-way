import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { MotionPlugin } from '@vueuse/motion';
import { createHead } from '@unhead/vue/client';
import App from './App.vue';
import router from './router/index';
import { i18n } from './i18n/index';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { installSafeBackTracker } from '@/composables/useSafeBack';
import { setupServiceWorker } from '@/pwa/registerSW';
import { initSentry } from '@/services/sentry';
import '@/styles/global.css';

const app = createApp(App);
const pinia = createPinia();
const head = createHead();

app.use(pinia);
app.use(head);
app.use(MotionPlugin);

// Hydrate theme before mount so the very first paint already carries the
// resolved data-theme attribute — avoids a light-to-dark flash on reload.
useThemeStore().init();

// Init auth BEFORE router — Vue Router starts initial navigation in install(),
// so the Firebase listener must be registered first or the guard waits forever.
const authStore = useAuthStore();
authStore.init();

app.use(router);
app.use(i18n);

// Count in-app navigations so `useSafeBack` knows whether a back arrow can
// safely call router.back(). Must register AFTER `app.use(router)` so the
// initial nav doesn't race the hook.
installSafeBackTracker(router);

void initSentry(app, router);

app.mount('#app');

void setupServiceWorker();

if (import.meta.env.DEV && import.meta.env['VITE_E2E'] === 'true') {
  void import('./e2e-bridge');
}
