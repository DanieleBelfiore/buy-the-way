import { useRouter, type RouteLocationRaw } from 'vue-router';

/**
 * Back button helper that never strands the user outside the app.
 *
 * If the current history entry was reached from another in-app route, this
 * delegates to `router.back()` (same UX as a browser Back). If it is the first
 * in-app entry of the tab - a deep link, a boot redirect (e.g. the default-list
 * redirect that fires on refresh), or an entry popped back to after visiting
 * another view - `router.back()` would leave the app or, in an installed PWA
 * with no prior history, do nothing at all. In that case we push the
 * caller-supplied fallback route instead.
 *
 * The check reads `back` from the router's own state on the current history
 * entry, so it stays correct after back/forward navigations. A global count of
 * past navigations does not: it stays positive once the user has moved
 * anywhere, even when they are back on the first entry.
 *
 * Usage:
 *   const safeBack = useSafeBack();
 *   safeBack({ name: 'lists' });
 */
export const useSafeBack = () => {
  const router = useRouter();
  return (fallback: RouteLocationRaw): void => {
    if (router.options.history.state['back']) {
      router.back();
    } else {
      void router.push(fallback);
    }
  };
};
