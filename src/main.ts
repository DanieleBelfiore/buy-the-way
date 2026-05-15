import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index';
import { i18n } from './i18n/index';
import { useAuthStore } from '@/stores/auth';
import '@/styles/global.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// Init auth BEFORE router — Vue Router starts initial navigation in install(),
// so the Firebase listener must be registered first or the guard waits forever.
const authStore = useAuthStore();
authStore.init();

app.use(router);
app.use(i18n);

app.mount('#app');
