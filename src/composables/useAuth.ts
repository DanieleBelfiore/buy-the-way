import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export interface UseAuthReturn {
  user: Ref<AuthUser | null>;
  ready: Ref<boolean>;
}

export const useAuth = (): UseAuthReturn => {
  const { user, ready } = storeToRefs(useAuthStore());
  return { user, ready };
};
