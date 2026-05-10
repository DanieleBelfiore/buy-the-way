import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { signInWithGoogle, signOutUser } from '@/services/auth.service';
import type { UserProfile } from '@/domain/types';

interface AuthStoreApi {
  readonly currentUser: Ref<UserProfile | null>;
  readonly isAuthenticated: ComputedRef<boolean>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = defineStore('auth', (): AuthStoreApi => {
  const currentUser = ref<UserProfile | null>(null);
  const isAuthenticated = computed<boolean>(() => currentUser.value !== null);

  const signIn = async (): Promise<void> => {
    const user = await signInWithGoogle();
    currentUser.value = user;
  };

  const signOut = async (): Promise<void> => {
    await signOutUser();
    currentUser.value = null;
  };

  return { currentUser, isAuthenticated, signIn, signOut };
});
