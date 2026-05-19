import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  signInWithGoogle,
  signOutCurrent,
  onAuthChanged,
  deleteAccount as deleteAccountSvc,
  reauthenticateGoogle,
} from '@/services/auth.service';
import type { AuthUser } from '@/composables/useAuth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const ready = ref(false);

  const init = (): (() => void) => {
    return onAuthChanged((authUser) => {
      user.value = authUser;
      ready.value = true;
    });
  };

  const signIn = (): Promise<void> => signInWithGoogle();

  const signOut = (): Promise<void> => signOutCurrent();

  const deleteAccount = (uid: string): Promise<void> => deleteAccountSvc(uid);

  const reauthenticate = (): Promise<void> => reauthenticateGoogle();

  return { user, ready, init, signIn, signOut, deleteAccount, reauthenticate };
});
