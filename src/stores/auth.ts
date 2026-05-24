import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  signInWithGoogle,
  signOutCurrent,
  onAuthChanged,
  deleteAccount as deleteAccountSvc,
  reauthenticateGoogle,
} from '@/services/auth.service';
import { getUserProfile, setUserDefaultList } from '@/services/users.service';
import type { UserProfile } from '@/domain/types';
import type { AuthUser } from '@/composables/useAuth';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const ready = ref(false);
  const profile = ref<UserProfile | null>(null);

  // Promise-singleton so concurrent `ensureProfile()` callers share one fetch.
  let profileLoadPromise: Promise<void> | null = null;

  const init = (): (() => void) => {
    return onAuthChanged((authUser) => {
      // Invalidate cached profile whenever the signed-in identity changes.
      // Cross-store cleanup (e.g. lists) lives on the consumer side — see
      // `src/stores/lists.ts`, which watches `auth.user?.uid` directly. That
      // avoids the dynamic import that would otherwise be needed to break the
      // auth↔lists module cycle.
      if (!authUser || authUser.uid !== user.value?.uid) {
        profile.value = null;
        profileLoadPromise = null;
      }
      user.value = authUser;
      ready.value = true;
    });
  };

  const ensureProfile = async (): Promise<void> => {
    if (!user.value) return;
    if (profile.value && profile.value.uid === user.value.uid) return;
    if (profileLoadPromise) return profileLoadPromise;
    const uid = user.value.uid;
    profileLoadPromise = getUserProfile(uid)
      .then((p) => {
        // Only commit if the user hasn't changed underneath us.
        if (user.value && user.value.uid === uid) {
          profile.value = p;
        }
      })
      .catch((err) => {
        console.warn('[auth] ensureProfile failed:', err);
      })
      .finally(() => {
        profileLoadPromise = null;
      });
    return profileLoadPromise;
  };

  const setDefaultListId = async (listId: string | null): Promise<void> => {
    if (!user.value) return;
    const uid = user.value.uid;
    await setUserDefaultList(uid, listId);
    if (profile.value && profile.value.uid === uid) {
      profile.value = { ...profile.value, defaultListId: listId };
    }
  };

  const signIn = (): Promise<void> => signInWithGoogle();

  const signOut = (): Promise<void> => signOutCurrent();

  const deleteAccount = (uid: string): Promise<void> => deleteAccountSvc(uid);

  const reauthenticate = (): Promise<void> => reauthenticateGoogle();

  return {
    user,
    ready,
    profile,
    init,
    ensureProfile,
    setDefaultListId,
    signIn,
    signOut,
    deleteAccount,
    reauthenticate,
  };
});
