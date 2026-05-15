import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import type { RouteLocationNormalized } from 'vue-router';

export const authGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
): Promise<{ name: string } | undefined> => {
  const { user, ready } = useAuth();

  if (!ready.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(ready, (isReady) => {
        if (isReady) {
          stop();
          resolve();
        }
      });
    });
  }

  const isAuthenticated = user.value !== null;
  const isLoginRoute = to.name === 'login';

  if (!isAuthenticated && !isLoginRoute) {
    return { name: 'login' };
  }

  if (isAuthenticated && isLoginRoute) {
    return { name: 'lists' };
  }

  return undefined;
};

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

router.beforeEach(authGuard);

export default router;
