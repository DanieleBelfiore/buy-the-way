import { defineStore } from 'pinia';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import type { UserProfile } from '@/domain/types';

interface AuthStoreApi {
  readonly currentUser: Ref<UserProfile | null>;
  readonly isAuthenticated: ComputedRef<boolean>;
  signIn: () => void;
  signOut: () => void;
}

/**
 * Thin Pinia wrapper over the {@link useAuth} composable. Exists so the rest
 * of the app can `useAuthStore()` without importing the composable directly,
 * which makes the Phase 4 swap (Firebase Auth) a single-file change.
 */
export const useAuthStore = defineStore('auth', (): AuthStoreApi => {
  const auth = useAuth();
  const isAuthenticated = computed<boolean>(() => auth.isAuthenticated.value);

  return {
    currentUser: auth.user,
    isAuthenticated,
    signIn: () => auth.signIn(),
    signOut: () => auth.signOut(),
  };
});
