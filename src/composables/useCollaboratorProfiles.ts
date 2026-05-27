import { ref, computed, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { getUsersByUids } from '@/services/users.service';
import type { UserProfile } from '@/domain/types';

const AVATAR_PALETTE = [
  'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
  'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
  'bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
  'bg-pink-200 text-pink-900 dark:bg-pink-900 dark:text-pink-100',
  'bg-lime-200 text-lime-900 dark:bg-lime-900 dark:text-lime-100',
  'bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100',
] as const;

/** Stable hue per uid - shared palette with ListCard. */
export const avatarColorFor = (uid: string): string => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]!;
};

export const initialFor = (m: UserProfile): string => {
  const source = m.displayName.trim() || m.email;
  return source.charAt(0).toUpperCase();
};

/**
 * Lazy-load collaborator profiles for avatar chips. Watches the uid list and
 * fetches only profiles not already cached in the local map.
 */
export const useCollaboratorProfiles = (
  collaboratorUids: MaybeRefOrGetter<readonly string[]>,
  maxAvatars = 4,
) => {
  const profileMap = ref<Map<string, UserProfile>>(new Map());

  const loadProfiles = async (uids: readonly string[]): Promise<void> => {
    const missing = uids.filter((u) => !profileMap.value.has(u));
    if (missing.length === 0) return;
    try {
      const profiles = await getUsersByUids(missing);
      const next = new Map(profileMap.value);
      for (const p of profiles) next.set(p.uid, p);
      profileMap.value = next;
    } catch (err) {
      console.warn('[useCollaboratorProfiles] loadProfiles failed:', err);
    }
  };

  watch(
    () => toValue(collaboratorUids),
    (uids) => {
      if (uids.length > 0) void loadProfiles(uids);
    },
    { immediate: true },
  );

  const visibleMembers = computed<UserProfile[]>(() =>
    toValue(collaboratorUids)
      .map((u) => profileMap.value.get(u))
      .filter((p): p is UserProfile => Boolean(p))
      .slice(0, maxAvatars),
  );

  const overflowMembersCount = computed(() =>
    Math.max(0, toValue(collaboratorUids).length - maxAvatars),
  );

  return {
    profileMap,
    visibleMembers,
    overflowMembersCount,
    initialFor,
    avatarColorFor,
  };
};
