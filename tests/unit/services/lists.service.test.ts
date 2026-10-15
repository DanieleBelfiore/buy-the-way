import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'lists' }),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
  limit: vi.fn().mockReturnValue({ type: 'limit' }),
  writeBatch: vi.fn().mockReturnValue({ delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }),
  arrayUnion: vi.fn((...vals: unknown[]) => ({ __arrayUnion: vals })),
  arrayRemove: vi.fn((...vals: unknown[]) => ({ __arrayRemove: vals })),
}));

import {
  createList,
  promoteAdmin,
  demoteAdmin,
  transferListOwnership,
  removeCollaborator,
  DuplicateListNameError,
  LastAdminError,
  NotACollaboratorError
} from '@/services/lists.service';
import { setDoc, updateDoc, getDoc,} from 'firebase/firestore';

describe('lists.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  describe('createList', () => {
    it('includes required fields in the list doc', async () => {
      await createList('Spesa', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({
        name: 'Spesa',
        ownerUid: 'uid-1',
        collaboratorUids: ['uid-1'],
        admins: ['uid-1'],
      });
      expect(data).not.toHaveProperty('deletedAt');
      // Counts are derived from the item docs, never stored on the list.
      expect(data).not.toHaveProperty('itemCount');
      expect(data).not.toHaveProperty('urgentCount');
      expect(typeof (data as any).createdAt).toBe('number');
      expect(typeof (data as any).updatedAt).toBe('number');
    });

    it('rejects when existingNames contains case-insensitive trim match', async () => {
      await expect(createList('  Spesa  ', 'uid-1', ['SPESA'])).rejects.toThrow(DuplicateListNameError);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  const mockListSnap = (data: {
    ownerUid: string;
    collaboratorUids: string[];
    admins?: string[];
  }) => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => data,
    } as any);
  };

  describe('promoteAdmin', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('throws NotACollaboratorError when target is not a collaborator', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner'], admins: ['owner'] });
      await expect(promoteAdmin('L1', 'stranger')).rejects.toBeInstanceOf(
        NotACollaboratorError,
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('demoteAdmin', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('throws LastAdminError when removal would leave no admins', async () => {
      mockListSnap({
        ownerUid: 'owner',
        collaboratorUids: ['owner', 'bob'],
        admins: ['owner'],
      });
      await expect(demoteAdmin('L1', 'owner')).rejects.toBeInstanceOf(LastAdminError);
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('pivots ownerUid to lex-first remaining admin when demoting current owner', async () => {
      mockListSnap({
        ownerUid: 'owner',
        collaboratorUids: ['owner', 'alice', 'bob'],
        admins: ['owner', 'alice', 'bob'],
      });
      await demoteAdmin('L1', 'owner');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({
        ownerUid: 'alice',
        admins: { __arrayRemove: ['owner'] },
      });
    });

    it('uses fallback admins=[ownerUid] when the legacy admins field is missing', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner', 'bob'] });
      await expect(demoteAdmin('L1', 'owner')).rejects.toBeInstanceOf(LastAdminError);
    });
  });

  describe('transferListOwnership (admins sync)', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('rejects when old and new owner are the same uid', async () => {
      await expect(transferListOwnership('L1', 'same', 'same')).rejects.toThrow();
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('removeCollaborator (also drops admins)', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('drops uid from both collaboratorUids and admins', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner', 'bob'], admins: ['owner', 'bob'] });
      await removeCollaborator('L1', 'bob');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({
        collaboratorUids: { __arrayRemove: ['bob'] },
        admins: { __arrayRemove: ['bob'] },
      });
    });
  });

  describe('computeReorderedSortIndex (S3.4)', () => {
    const mk = (sortIndex?: number, updatedAt = 1) => ({ id: 'x', sortIndex, updatedAt } as any);

    it('returns midpoint between neighbours', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      const ordered = [mk(200), mk(150), mk(100)];
      // moved to position 1, between 200 and 100 -> 150
      expect(computeReorderedSortIndex(ordered, 1)).toBe(150);
    });

    it('steps one BELOW the top row when dropped at the top edge', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      // Position 0 has no above, below is 200 -> result = 200 + 1
      const ordered = [mk(150), mk(200)];
      expect(computeReorderedSortIndex(ordered, 0)).toBe(201);
    });

    it('steps one ABOVE the bottom row when dropped at the bottom edge', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      // Position 1 has above=150 and no below -> result = 150 - 1
      const ordered = [mk(150), mk(50)];
      expect(computeReorderedSortIndex(ordered, 1)).toBe(149);
    });
  });
});
