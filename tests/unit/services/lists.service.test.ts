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
  subscribeUserLists,
  promoteAdmin,
  demoteAdmin,
  transferListOwnership,
  removeCollaborator,
  leaveList,
  capitalizeListName,
  DuplicateListNameError,
  LastAdminError,
  NotACollaboratorError,
} from '@/services/lists.service';
import { setDoc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';

describe('lists.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  describe('createList', () => {
    it('writes a list doc via setDoc', async () => {
      await createList('Spesa', 'uid-1');
      expect(setDoc).toHaveBeenCalledOnce();
    });

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
      expect(typeof (data as any).createdAt).toBe('number');
      expect(typeof (data as any).updatedAt).toBe('number');
    });

    it('returns a 26-char ULID id', async () => {
      const id = await createList('Latte', 'uid-1');
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(26);
    });

    it('sets id in the doc matching the returned id', async () => {
      const id = await createList('Latte', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).id).toBe(id);
    });

    it('rejects when existingNames contains case-insensitive trim match', async () => {
      await expect(createList('  Spesa  ', 'uid-1', ['SPESA'])).rejects.toThrow(DuplicateListNameError);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not reject when existingNames has only different names', async () => {
      await expect(createList('Spesa', 'uid-1', ['Lavoro', 'Casa'])).resolves.toBeTypeOf('string');
    });

    it('trims input name before writing', async () => {
      await createList('  Spesa  ', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Spesa');
    });

    it('capitalizes the first letter when input is lowercase', async () => {
      await createList('spesa', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Spesa');
    });

    it('preserves capitalization beyond the first letter', async () => {
      await createList('iPhone shopping', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('IPhone shopping');
    });

    it('handles unicode initials', async () => {
      await createList('über shop', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Über shop');
    });

    it('treats whitespace-only name as duplicate of empty (no write skipped beyond existing logic)', async () => {
      await createList('  ', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('');
    });
  });

  describe('capitalizeListName', () => {
    it('uppercases the first letter', () => {
      expect(capitalizeListName('spesa')).toBe('Spesa');
    });

    it('leaves already-capitalized name alone', () => {
      expect(capitalizeListName('Spesa')).toBe('Spesa');
    });

    it('trims surrounding whitespace', () => {
      expect(capitalizeListName('  spesa  ')).toBe('Spesa');
    });

    it('returns empty string for blank input', () => {
      expect(capitalizeListName('   ')).toBe('');
    });

    it('leaves non-letter initials alone', () => {
      expect(capitalizeListName('123 lista')).toBe('123 lista');
    });
  });

  describe('subscribeUserLists', () => {
    it('returns an unsubscribe function', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      const unsub = subscribeUserLists('uid-1', vi.fn(), vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('calls onSnapshot with a query', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      subscribeUserLists('uid-1', vi.fn(), vi.fn());
      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('maps snapshot docs to List objects and calls onChange', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any, _onError: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });

      const onChange = vi.fn();
      subscribeUserLists('uid-1', onChange, vi.fn());

      capturedNext!({
        docs: [
          {
            id: '01ABCDEFGH01234567890ABC12',
            data: () => ({
              name: 'Spesa',
              ownerUid: 'uid-1',
              collaboratorUids: ['uid-1'],
              createdAt: 100,
              updatedAt: 200,
            }),
          },
        ],
      });

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toHaveLength(1);
      expect(onChange.mock.calls[0][0][0]).toMatchObject({
        id: '01ABCDEFGH01234567890ABC12',
        name: 'Spesa',
        ownerUid: 'uid-1',
      });
    });

    it('calls onError on snapshot error', () => {
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(new Error('permission-denied'));
        return vi.fn() as any;
      });

      const onError = vi.fn();
      subscribeUserLists('uid-1', vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
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

    it('arrayUnion target into admins for an existing collaborator', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner', 'bob'], admins: ['owner'] });
      await promoteAdmin('L1', 'bob');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({ admins: { __arrayUnion: ['bob'] } });
      expect(typeof (patch as any).updatedAt).toBe('number');
    });

    it('throws NotACollaboratorError when target is not a collaborator', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner'], admins: ['owner'] });
      await expect(promoteAdmin('L1', 'stranger')).rejects.toBeInstanceOf(
        NotACollaboratorError,
      );
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('is idempotent - promoting an already-admin uid still writes arrayUnion', async () => {
      mockListSnap({
        ownerUid: 'owner',
        collaboratorUids: ['owner', 'bob'],
        admins: ['owner', 'bob'],
      });
      await promoteAdmin('L1', 'bob');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({ admins: { __arrayUnion: ['bob'] } });
    });
  });

  describe('demoteAdmin', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('drops target from admins when other admins remain', async () => {
      mockListSnap({
        ownerUid: 'owner',
        collaboratorUids: ['owner', 'bob'],
        admins: ['owner', 'bob'],
      });
      await demoteAdmin('L1', 'bob');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({ admins: { __arrayRemove: ['bob'] } });
      expect((patch as any).ownerUid).toBeUndefined();
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

    it('is a no-op when target is not currently an admin', async () => {
      mockListSnap({
        ownerUid: 'owner',
        collaboratorUids: ['owner', 'bob'],
        admins: ['owner'],
      });
      await demoteAdmin('L1', 'bob');
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

    it('writes the pivot then strips old owner from admins in a follow-up call', async () => {
      await transferListOwnership('L1', 'oldOwner', 'newOwner');
      expect(updateDoc).toHaveBeenCalledTimes(2);
      const [, first] = vi.mocked(updateDoc).mock.calls[0];
      expect(first).toMatchObject({
        ownerUid: 'newOwner',
        collaboratorUids: { __arrayRemove: ['oldOwner'] },
        admins: { __arrayUnion: ['newOwner'] },
      });
      const [, second] = vi.mocked(updateDoc).mock.calls[1];
      expect(second).toMatchObject({ admins: { __arrayRemove: ['oldOwner'] } });
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

  describe('leaveList (also drops admins)', () => {
    beforeEach(() => {
      vi.mocked(updateDoc).mockResolvedValue(undefined);
    });

    it('drops self from both collaboratorUids and admins', async () => {
      mockListSnap({ ownerUid: 'owner', collaboratorUids: ['owner', 'bob'], admins: ['owner', 'bob'] });
      await leaveList('L1', 'bob');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toMatchObject({
        collaboratorUids: { __arrayRemove: ['bob'] },
        admins: { __arrayRemove: ['bob'] },
      });
    });
  });

  describe('setListCategoryOrder', () => {
    it('writes categoryOrder + updatedAt via updateDoc', async () => {
      const { setListCategoryOrder } = await import('@/services/lists.service');
      await setListCategoryOrder('L1', ['dairy', 'bakery', 'other']);
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect((patch as any).categoryOrder).toEqual(['dairy', 'bakery', 'other']);
      expect(typeof (patch as any).updatedAt).toBe('number');
    });

    it('clones the input array (no shared reference with caller)', async () => {
      const { setListCategoryOrder } = await import('@/services/lists.service');
      const input: any[] = ['dairy', 'bakery'];
      await setListCategoryOrder('L1', input);
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect((patch as any).categoryOrder).not.toBe(input);
      expect((patch as any).categoryOrder).toEqual(input);
    });
  });

  describe('reorderList (S3.4)', () => {
    it('updates sortIndex + updatedAt via updateDoc', async () => {
      const { reorderList } = await import('@/services/lists.service');
      await reorderList('L1', 12345);
      expect(updateDoc).toHaveBeenCalledOnce();
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect((patch as any).sortIndex).toBe(12345);
      expect(typeof (patch as any).updatedAt).toBe('number');
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

    it('falls back to updatedAt when sortIndex is missing on a neighbour', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      const ordered = [mk(undefined, 1000), mk(undefined, 500), mk(undefined, 100)];
      // midpoint(1000, 100) = 550
      expect(computeReorderedSortIndex(ordered, 1)).toBe(550);
    });

    it('returns `now` when newIndex is out of range', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      expect(computeReorderedSortIndex([mk(100)], 5, 42)).toBe(42);
    });

    it('returns `now` for a single-element array (no neighbours)', async () => {
      const { computeReorderedSortIndex } = await import('@/services/lists.service');
      expect(computeReorderedSortIndex([mk(100)], 0, 99)).toBe(99);
    });
  });

  describe('createList sortIndex seeding (S3.4)', () => {
    it('seeds sortIndex equal to the createdAt timestamp', async () => {
      const before = Date.now();
      await createList('Spesa', 'uid-1');
      const after = Date.now();
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      const seeded = (data as any).sortIndex;
      expect(typeof seeded).toBe('number');
      expect(seeded).toBeGreaterThanOrEqual(before);
      expect(seeded).toBeLessThanOrEqual(after);
    });
  });

  describe('subscribeUserLists client-side sort (S3.4)', () => {
    it('orders by sortIndex desc, falling back to updatedAt when missing', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });
      const onChange = vi.fn();
      subscribeUserLists('uid-1', onChange, vi.fn());

      capturedNext!({
        docs: [
          { id: 'A', data: () => ({ name: 'A', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 10, sortIndex: 100 }) },
          { id: 'B', data: () => ({ name: 'B', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 50 /* legacy: no sortIndex */ }) },
          { id: 'C', data: () => ({ name: 'C', ownerUid: 'u', collaboratorUids: ['u'], createdAt: 1, updatedAt: 5, sortIndex: 200 }) },
        ],
      });

      const ids = onChange.mock.calls[0][0].map((l: any) => l.id);
      // sortIndex C=200, A=100, B=50 (fallback updatedAt) -> C, A, B
      expect(ids).toEqual(['C', 'A', 'B']);
    });
  });
});
