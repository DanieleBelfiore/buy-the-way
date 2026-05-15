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
app.use(router);
app.use(i18n);

// Boot auth subscription so guard's `ready` resolves
const authStore = useAuthStore();
authStore.init();

app.mount('#app');
