import { createRouter, createWebHistory } from 'vue-router';
import { watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useAuthStore } from '@/stores/auth';
import { PUBLIC_ROUTE_NAMES, ROUTE_META } from '@/router/meta';
import { consumeReturnTo, saveReturnTo } from '@/domain/returnTo';
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

// One-shot flag so the default-list boot redirect only fires on the very
// first navigation of a session, not every time the user returns to /lists.
let defaultListRedirectArmed = true;

/** Test-only escape hatch - re-arms the boot redirect between tests. */
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
  const isHomeRoute = to.name === 'home';
  const isPublicRoute = typeof to.name === 'string' && PUBLIC_ROUTE_NAMES.has(to.name);

  if (!isAuthenticated && !isPublicRoute) {
    if (typeof to.name === 'string' && ROUTE_META[to.name]?.returnAfterLogin) {
      saveReturnTo(to.fullPath);
    }
    return { name: 'login' };
  }

  // The landing page and /login are public, but authenticated users have no
  // reason to see them - send them straight into the app (which then chains to
  // the default-list boot redirect below). Coming back from a sign-in that
  // started on a `returnAfterLogin` route (Google redirect flow) resumes it.
  if (isAuthenticated && isLoginRoute) {
    return consumeReturnTo() ?? { name: 'lists' };
  }
  if (isAuthenticated && isHomeRoute) {
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
    // Prefer the locally cached default so a cold open does not sit on the
    // splash for a profile round trip. The profile still refreshes in the
    // background, which rewrites the cache if it changed on another device.
    let defaultId = authStore.cachedDefaultListId();
    if (defaultId === undefined) {
      try {
        await authStore.ensureProfile();
      } catch {
        // Profile fetch failed - fall through to /lists silently.
      }
      defaultId = authStore.profile?.defaultListId;
    } else {
      void authStore.ensureProfile().catch(() => {});
    }
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
      name: 'home',
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/auth/email-link-callback',
      name: 'email-link-callback',
      component: () => import('@/views/EmailLinkCallbackView.vue'),
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
    {
      // OAuth authorization_endpoint of the MCP server: consent screen.
      path: '/oauth/authorize',
      name: 'oauth-authorize',
      component: () => import('@/views/OAuthAuthorizeView.vue'),
    },
    {
      // Unknown URLs get a branded 404 instead of bouncing to /login, which
      // read as "you must sign in" for a mistyped or dead link.
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
});

router.beforeEach(authGuard);

export default router;
