import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { PUBLIC_ROUTE_NAMES } from '@/router/meta';
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
  const isPublicRoute = typeof to.name === 'string' && PUBLIC_ROUTE_NAMES.has(to.name);

  if (!isAuthenticated && !isPublicRoute) {
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
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/PrivacyView.vue'),
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/TermsView.vue'),
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
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
    },
  ],
});

router.beforeEach(authGuard);

export default router;
