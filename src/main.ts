import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import { initPWA } from './pwa/registerSW';
import './styles/global.css';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

if (USE_FIXTURES) {
  app.use(router);
  app.use(i18n);
  app.mount('#app');
  initPWA();
} else {
  const authStore = useAuthStore();
  authStore.initialize().then(() => {
    app.use(router);
    app.use(i18n);
    app.mount('#app');
    initPWA();
  });
}
