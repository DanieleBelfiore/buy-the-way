import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { signInWithGoogle, signOutUser, initAuthListener } from '@/services/auth.service';
import type { UserProfile } from '@/domain/types';

interface AuthStoreApi {
  readonly currentUser: Ref<UserProfile | null>;
  readonly isAuthenticated: ComputedRef<boolean>;
  readonly isReady: Ref<boolean>;
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = defineStore('auth', (): AuthStoreApi => {
  const currentUser = ref<UserProfile | null>(null);
  const isAuthenticated = computed<boolean>(() => currentUser.value !== null);
  const isReady = ref<boolean>(false);

  const initialize = (): Promise<void> => {
    return new Promise((resolve) => {
      initAuthListener((user) => {
        currentUser.value = user;
        if (!isReady.value) {
          isReady.value = true;
          resolve();
        }
      });
    });
  };

  const signIn = async (): Promise<void> => {
    const user = await signInWithGoogle();
    currentUser.value = user;
  };

  const signOut = async (): Promise<void> => {
    await signOutUser();
    currentUser.value = null;
  };

  return { currentUser, isAuthenticated, isReady, initialize, signIn, signOut };
});
