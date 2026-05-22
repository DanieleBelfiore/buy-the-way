import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import { PUBLIC_ROUTE_NAMES } from '@/router/meta';
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

// One-shot flag so the default-list boot redirect only fires on the very
// first navigation of a session, not every time the user returns to /lists.
let defaultListRedirectArmed = true;

/** Test-only escape hatch — re-arms the boot redirect between tests. */
export const __resetDefaultListRedirect = (): void => {
  defaultListRedirectArmed = true;
};

export const authGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): Promise<RouteLocationRaw | undefined> => {
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

  // Boot-only default-list redirect: when the app first loads and the user
  // lands on /lists, jump straight into their default list if one is set.
  // Skipped on subsequent navigations (back from detail, etc.) to avoid loops.
  if (
    defaultListRedirectArmed &&
    isAuthenticated &&
    from.name === undefined &&
    to.name === 'lists'
  ) {
    defaultListRedirectArmed = false;
    const authStore = useAuthStore();
    try {
      await authStore.ensureProfile();
    } catch {
      // Profile fetch failed — fall through to /lists silently.
    }
    const defaultId = authStore.profile?.defaultListId;
    if (defaultId) {
      return { name: 'list-detail', params: { id: defaultId } };
    }
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
