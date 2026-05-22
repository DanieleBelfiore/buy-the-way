import { useRouter, type Router, type RouteLocationRaw } from 'vue-router';

/**
 * Number of in-app navigations that have committed since boot. Bumped by the
 * afterEach hook installed by `installSafeBackTracker`. Module-level so the
 * counter is shared by every component instance.
 */
let committedInAppNavs = 0;

/**
 * Register a router afterEach that counts only committed *in-app* navigations
 * (i.e. those where `from.name` is defined — not the synthetic START_LOCATION
 * that Vue Router uses for the initial nav or for boot-redirect targets).
 *
 * Call this once in main.ts after `createRouter`.
 */
export const installSafeBackTracker = (router: Router): void => {
  router.afterEach((_to, from) => {
    if (from.name !== undefined) {
      committedInAppNavs += 1;
    }
  });
};

/**
 * Test-only escape hatch — resets the module counter between tests so each
 * `useSafeBack` run starts from a known state.
 */
export const __resetSafeBackForTests = (): void => {
  committedInAppNavs = 0;
};

/**
 * Back button helper that never strands the user outside the app.
 *
 * If the user navigated to the current view from another in-app route, this
 * delegates to `router.back()` (same UX as a browser Back). If they landed
 * here via a deep link, a boot redirect (e.g. the default-list redirect that
 * fires on refresh), or any other entry that didn't go through an in-app
 * navigation, `router.back()` would pop the browser history back to whatever
 * the user had open before — typically the wrong page or even another site.
 * In that case we push the caller-supplied fallback route instead.
 *
 * Usage:
 *   const safeBack = useSafeBack();
 *   safeBack({ name: 'lists' });
 */
export const useSafeBack = () => {
  const router = useRouter();
  return (fallback: RouteLocationRaw): void => {
    if (committedInAppNavs > 0) {
      router.back();
    } else {
      void router.push(fallback);
    }
  };
};
