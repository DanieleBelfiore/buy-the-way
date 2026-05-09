import { ref, type Ref } from 'vue';
import type { UserProfile } from '@/domain/types';

// Module-scope singleton refs so the router guard and any consumer
// component share the same reactive auth state. Replaced by Firebase
// Auth wiring in Phase 4. Until then, this is a deterministic mock.
const globalIsAuthenticated: Ref<boolean> = ref(false);
const globalUser: Ref<UserProfile | null> = ref(null);

const MOCK_USER: UserProfile = {
  uid: 'mock-uid',
  email: 'mock@example.com',
  displayName: 'Mock User',
  lastLoginAt: 0,
};

export interface UseAuth {
  readonly isAuthenticated: Ref<boolean>;
  readonly user: Ref<UserProfile | null>;
  signIn: () => void;
  signOut: () => void;
}

export const useAuth = (): UseAuth => ({
  isAuthenticated: globalIsAuthenticated,
  user: globalUser,
  signIn: () => {
    globalUser.value = { ...MOCK_USER, lastLoginAt: Date.now() };
    globalIsAuthenticated.value = true;
  },
  signOut: () => {
    globalUser.value = null;
    globalIsAuthenticated.value = false;
  },
});
