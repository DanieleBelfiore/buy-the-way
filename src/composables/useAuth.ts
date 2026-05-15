import { ref } from 'vue';
import type { Ref } from 'vue';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface UseAuthReturn {
  user: Ref<AuthUser | null>;
  ready: Ref<boolean>;
}

export const useAuth = (): UseAuthReturn => ({
  user: ref(null),
  ready: ref(true),
});
