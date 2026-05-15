import { defineStore } from 'pinia';
import { ref } from 'vue';
import { signInWithGoogle, signOutCurrent, onAuthChanged } from '@/services/auth.service';
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

  return { user, ready, init, signIn, signOut };
});
