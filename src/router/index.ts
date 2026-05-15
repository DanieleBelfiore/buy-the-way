import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/lists',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/lists',
      name: 'lists',
      component: () => import('@/views/ListsView.vue'),
    },
    {
      path: '/lists/:id',
      name: 'list-detail',
      component: () => import('@/views/ListDetailView.vue'),
    },
    {
      path: '/lists/:id/settings',
      name: 'list-settings',
      component: () => import('@/views/ListSettingsView.vue'),
    },
    {
      path: '/trash',
      name: 'trash',
      component: () => import('@/views/TrashView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
});

export default router;
