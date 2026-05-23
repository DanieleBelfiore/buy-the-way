import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  arrayUnion: vi.fn((...args) => ({ __op: 'arrayUnion', args })),
  arrayRemove: vi.fn((...args) => ({ __op: 'arrayRemove', args })),
  collection: vi.fn().mockReturnValue({ id: 'items' }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('@/services/users.service', () => ({
  findUserByEmail: vi.fn(),
}));

import {
  addCollaborator,
  removeCollaborator,
  leaveList,
  renameList,
  deleteList,
  transferListOwnership,
  CannotRemoveOwnerError,
} from '@/services/lists.service';
import {
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { findUserByEmail } from '@/services/users.service';

describe('lists.service collaborator ops', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateDoc).mockResolvedValue(undefined);
  });

  describe('addCollaborator', () => {
    it('queues a pending invite when the email is not yet registered', async () => {
      vi.mocked(findUserByEmail).mockResolvedValue(null);
      const result = await addCollaborator('list-1', 'nobody@x.com');
      expect(result).toEqual({ profile: null, pending: true, email: 'nobody@x.com' });
      expect(arrayUnion).toHaveBeenCalledWith('nobody@x.com');
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        pendingInviteEmails: { __op: 'arrayUnion', args: ['nobody@x.com'] },
      });
    });

    it('adds uid via arrayUnion and bumps updatedAt on success', async () => {
      vi.mocked(findUserByEmail).mockResolvedValue({
        uid: 'uid-2',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
      });

      const result = await addCollaborator('list-1', 'a@b.com');
      expect(result.profile).toEqual({ uid: 'uid-2', email: 'a@b.com', displayName: 'A', lastLoginAt: 0 });
      expect(result.pending).toBe(false);
      expect(arrayUnion).toHaveBeenCalledWith('uid-2');
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        collaboratorUids: { __op: 'arrayUnion', args: ['uid-2'] },
      });
      expect(typeof (payload as any).updatedAt).toBe('number');
    });

    it('normalizes email lookup (lower + trim before findUserByEmail)', async () => {
      vi.mocked(findUserByEmail).mockResolvedValue({
        uid: 'uid-3',
        email: 'foo@bar.com',
        displayName: '',
        lastLoginAt: 0,
      });
      await addCollaborator('list-1', '  FOO@BAR.COM  ');
      expect(findUserByEmail).toHaveBeenCalledWith('foo@bar.com');
    });

    it('removes any pre-existing pending invite for the email on registered add', async () => {
      vi.mocked(findUserByEmail).mockResolvedValue({
        uid: 'uid-2',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 0,
      });
      await addCollaborator('list-1', 'a@b.com');
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        pendingInviteEmails: { __op: 'arrayRemove', args: ['a@b.com'] },
      });
    });
  });

  describe('claimPendingInvites', () => {
    it('returns 0 with no matches', async () => {
      vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);
      const { claimPendingInvites } = await import('@/services/lists.service');
      const n = await claimPendingInvites('uid-new', 'a@b.com');
      expect(n).toBe(0);
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('promotes the user into collaboratorUids on each matching list', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [
          { id: 'list-a' },
          { id: 'list-b' },
        ],
      } as any);
      const { claimPendingInvites } = await import('@/services/lists.service');
      const n = await claimPendingInvites('uid-new', 'A@B.com');
      expect(n).toBe(2);
      expect(updateDoc).toHaveBeenCalledTimes(2);
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        collaboratorUids: { __op: 'arrayUnion', args: ['uid-new'] },
        pendingInviteEmails: { __op: 'arrayRemove', args: ['a@b.com'] },
      });
    });

    it('returns 0 and swallows errors when query fails', async () => {
      vi.mocked(getDocs).mockRejectedValue(new Error('rules denied'));
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { claimPendingInvites } = await import('@/services/lists.service');
      const n = await claimPendingInvites('uid-new', 'a@b.com');
      expect(n).toBe(0);
      consoleWarn.mockRestore();
    });

    it('returns 0 for empty email without hitting Firestore', async () => {
      const { claimPendingInvites } = await import('@/services/lists.service');
      const n = await claimPendingInvites('uid-new', '   ');
      expect(n).toBe(0);
      expect(getDocs).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingInvite', () => {
    it('arrayRemoves the normalized email and bumps updatedAt', async () => {
      const { cancelPendingInvite } = await import('@/services/lists.service');
      await cancelPendingInvite('list-1', '  X@Y.COM ');
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        pendingInviteEmails: { __op: 'arrayRemove', args: ['x@y.com'] },
      });
      expect(typeof (payload as any).updatedAt).toBe('number');
    });
  });

  describe('removeCollaborator', () => {
    it('removes uid via arrayRemove', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-1' }),
      } as any);

      await removeCollaborator('list-1', 'uid-2');
      expect(arrayRemove).toHaveBeenCalledWith('uid-2');
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({
        collaboratorUids: { __op: 'arrayRemove', args: ['uid-2'] },
      });
      expect(typeof (payload as any).updatedAt).toBe('number');
    });

    it('throws CannotRemoveOwnerError when target is owner', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-1' }),
      } as any);

      await expect(removeCollaborator('list-1', 'owner-1')).rejects.toBeInstanceOf(
        CannotRemoveOwnerError,
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('throws when list missing', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      await expect(removeCollaborator('list-x', 'uid-2')).rejects.toThrow();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('leaveList', () => {
    it('removes self uid via arrayRemove', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'owner-1' }),
      } as any);

      await leaveList('list-1', 'uid-self');
      expect(arrayRemove).toHaveBeenCalledWith('uid-self');
      expect(updateDoc).toHaveBeenCalledOnce();
    });

    it('throws CannotRemoveOwnerError when owner tries to leave', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ownerUid: 'uid-self' }),
      } as any);

      await expect(leaveList('list-1', 'uid-self')).rejects.toBeInstanceOf(
        CannotRemoveOwnerError,
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('renameList', () => {
    it('writes trimmed + capitalized name and bumps updatedAt', async () => {
      await renameList('list-1', '  cucina  ');
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({ name: 'Cucina' });
      expect(typeof (payload as any).updatedAt).toBe('number');
    });

    it('preserves already-capitalized name', async () => {
      await renameList('list-1', 'Casa');
      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toMatchObject({ name: 'Casa' });
    });

    it('throws on empty name', async () => {
      await expect(renameList('list-1', '   ')).rejects.toThrow();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('deleteList', () => {
    it('hard-deletes all items in batches then the list doc', async () => {
      const ids = ['i1', 'i2', 'i3'];
      vi.mocked(getDocs).mockResolvedValue({
        docs: ids.map((id) => ({ id })),
      } as any);
      const batchDelete = vi.fn();
      const batchCommit = vi.fn().mockResolvedValue(undefined);
      vi.mocked(writeBatch).mockReturnValue({
        delete: batchDelete,
        commit: batchCommit,
      } as any);

      await deleteList('list-1');

      expect(batchDelete).toHaveBeenCalledTimes(3);
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(deleteDoc).toHaveBeenCalledOnce();
    });

    it('still deletes list doc when no items exist', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);
      const batchDelete = vi.fn();
      const batchCommit = vi.fn().mockResolvedValue(undefined);
      vi.mocked(writeBatch).mockReturnValue({
        delete: batchDelete,
        commit: batchCommit,
      } as any);

      await deleteList('list-1');

      expect(batchCommit).not.toHaveBeenCalled();
      expect(deleteDoc).toHaveBeenCalledOnce();
    });
  });

  describe('transferListOwnership', () => {
    it('writes new ownerUid + promotes new admin in first write, strips old owner from admins in follow-up', async () => {
      await transferListOwnership('list-1', 'old-uid', 'new-uid');
      expect(arrayRemove).toHaveBeenCalledWith('old-uid');
      expect(updateDoc).toHaveBeenCalledTimes(2);
      const [, firstPayload] = vi.mocked(updateDoc).mock.calls[0];
      expect(firstPayload).toMatchObject({
        ownerUid: 'new-uid',
        collaboratorUids: { __op: 'arrayRemove', args: ['old-uid'] },
        admins: { __op: 'arrayUnion', args: ['new-uid'] },
      });
      expect(typeof (firstPayload as any).updatedAt).toBe('number');
      const [, secondPayload] = vi.mocked(updateDoc).mock.calls[1];
      expect(secondPayload).toMatchObject({
        admins: { __op: 'arrayRemove', args: ['old-uid'] },
      });
    });

    it('throws when old and new owner are the same uid', async () => {
      await expect(transferListOwnership('list-1', 'same', 'same')).rejects.toThrow();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
