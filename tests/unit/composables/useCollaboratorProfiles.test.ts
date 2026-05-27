import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';

vi.mock('@/services/users.service', () => ({
  getUsersByUids: vi.fn(),
}));

import { getUsersByUids } from '@/services/users.service';
import {
  avatarColorFor,
  initialFor,
  useCollaboratorProfiles,
} from '@/composables/useCollaboratorProfiles';
import type { UserProfile } from '@/domain/types';

const mockGetUsersByUids = vi.mocked(getUsersByUids);

const profile = (uid: string, name: string, email: string): UserProfile => ({
  uid,
  email,
  displayName: name,
  lastLoginAt: 0,
});

describe('useCollaboratorProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialFor uses displayName first letter', () => {
    expect(initialFor(profile('u1', 'Alice', 'a@b.com'))).toBe('A');
    expect(initialFor(profile('u2', '', 'bob@example.com'))).toBe('B');
  });

  it('avatarColorFor is stable for the same uid', () => {
    expect(avatarColorFor('uid-abc')).toBe(avatarColorFor('uid-abc'));
  });

  it('loads missing profiles when collaborator uids change', async () => {
    mockGetUsersByUids.mockResolvedValue([profile('u1', 'Alice', 'a@b.com')]);
    const uids = ref<string[]>(['u1']);
    const { visibleMembers } = useCollaboratorProfiles(uids, 4);

    await vi.waitFor(() => expect(visibleMembers.value).toHaveLength(1));
    expect(visibleMembers.value[0]?.displayName).toBe('Alice');
    expect(mockGetUsersByUids).toHaveBeenCalledWith(['u1']);
  });

  it('caps visible members at maxAvatars', async () => {
    mockGetUsersByUids.mockImplementation(async (ids) =>
      ids.map((uid) => profile(uid, uid, `${uid}@example.com`)),
    );
    const uids = computed(() => ['u1', 'u2', 'u3', 'u4', 'u5']);
    const { visibleMembers, overflowMembersCount } = useCollaboratorProfiles(uids, 3);

    await vi.waitFor(() => expect(visibleMembers.value).toHaveLength(3));
    expect(overflowMembersCount.value).toBe(2);
  });

  it('skips refetch when profiles are already cached', async () => {
    mockGetUsersByUids.mockResolvedValue([profile('u1', 'Alice', 'a@b.com')]);
    const uids = ref<string[]>(['u1']);
    useCollaboratorProfiles(uids, 4);
    await vi.waitFor(() => expect(mockGetUsersByUids).toHaveBeenCalledOnce());
    uids.value = ['u1', 'u2'];
    mockGetUsersByUids.mockResolvedValue([profile('u2', 'Bob', 'b@b.com')]);
    await vi.waitFor(() => expect(mockGetUsersByUids).toHaveBeenCalledTimes(2));
    expect(mockGetUsersByUids).toHaveBeenLastCalledWith(['u2']);
  });

  it('swallows profile load errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetUsersByUids.mockRejectedValue(new Error('network'));
    useCollaboratorProfiles(ref(['u1']), 4);
    await vi.waitFor(() => expect(mockGetUsersByUids).toHaveBeenCalled());
    warn.mockRestore();
  });
});
