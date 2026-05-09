import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

// Public routes do not require authentication. The guard treats anything
// not in this set (matched by exact path for now) as auth-required.
const PUBLIC_PATHS: readonly string[] = ['/login'];

export const routes: readonly RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'lists',
    component: () => import('@/views/ListsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/lists/:id',
    name: 'list-detail',
    component: () => import('@/views/ListDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/lists/:id/settings',
    name: 'list-settings',
    component: () => import('@/views/ListSettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/lists/:id/collaborators/add',
    name: 'add-collaborator',
    component: () => import('@/views/AddCollaboratorView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/trash',
    name: 'trash',
    component: () => import('@/views/TrashView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
];

/**
 * Pure auth-guard decision. Extracted so it can be unit-tested without
 * spinning up a real router. Returns either a redirect path string or
 * `true` to allow navigation.
 */
export const redirectTarget = (isAuthed: boolean, toPath: string): string | true => {
  if (isAuthed) return true;
  if (PUBLIC_PATHS.includes(toPath)) return true;
  return '/login';
};

export const router = createRouter({
  history: createWebHistory(),
  routes: routes as RouteRecordRaw[],
});

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth();
  return redirectTarget(isAuthenticated.value, to.path);
});
