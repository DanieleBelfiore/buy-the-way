import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('@/services/users.service', () => ({ findUserByEmail: vi.fn() }));

const {
  mockDoc,
  mockSetDoc,
  mockUpdateDoc,
  mockOnSnapshot,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockArrayUnion,
  mockArrayRemove,
} = vi.hoisted(() => ({
  mockDoc: vi.fn((_db: any, ...segs: string[]) => ({ path: segs.join('/') })),
  mockSetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockOnSnapshot: vi.fn(() => vi.fn()),
  mockCollection: vi.fn((_db: any, path: string) => ({ path })),
  mockQuery: vi.fn((...args: any[]) => args),
  mockWhere: vi.fn((...args: any[]) => args),
  mockOrderBy: vi.fn((...args: any[]) => args),
  mockArrayUnion: vi.fn((...args: any[]) => ({ _type: 'arrayUnion', args })),
  mockArrayRemove: vi.fn((...args: any[]) => ({ _type: 'arrayRemove', args })),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  onSnapshot: mockOnSnapshot,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  arrayUnion: mockArrayUnion,
  arrayRemove: mockArrayRemove,
}));

import {
  createList,
  renameList,
  softDeleteList,
  restoreList,
  addCollaborator,
  removeCollaborator,
  leaveList,
  subscribeUserLists,
  UserNotRegisteredError,
} from '@/services/lists.service';
import { findUserByEmail } from '@/services/users.service';
import type { List } from '@/domain/types';

const mockFindUser = vi.mocked(findUserByEmail);

const BASE_LIST: List = {
  id: 'list-abc' as any,
  name: 'Test List',
  ownerUid: 'uid-owner',
  collaboratorUids: [],
  deletedAt: null,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('lists.service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createList', () => {
    it('calls setDoc with the list document', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await createList(BASE_LIST);
      expect(mockSetDoc).toHaveBeenCalledOnce();
      const [, data] = mockSetDoc.mock.calls[0]!;
      expect((data as any).name).toBe('Test List');
      expect((data as any).ownerUid).toBe('uid-owner');
    });
  });

  describe('renameList', () => {
    it('calls updateDoc with name and updatedAt', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await renameList('list-abc' as any, 'New Name');
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).name).toBe('New Name');
      expect(typeof (patch as any).updatedAt).toBe('number');
    });
  });

  describe('softDeleteList', () => {
    it('sets deletedAt to a timestamp', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await softDeleteList('list-abc' as any);
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect(typeof (patch as any).deletedAt).toBe('number');
    });
  });

  describe('restoreList', () => {
    it('sets deletedAt to null', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await restoreList('list-abc' as any);
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).deletedAt).toBeNull();
    });
  });

  describe('addCollaborator', () => {
    it('throws UserNotRegisteredError when email not found', async () => {
      mockFindUser.mockResolvedValue(null);
      await expect(addCollaborator('list-abc' as any, 'ghost@example.com')).rejects.toBeInstanceOf(
        UserNotRegisteredError,
      );
    });

    it('arrayUnions the uid when user is found', async () => {
      mockFindUser.mockResolvedValue({
        uid: 'uid-alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        lastLoginAt: 0,
      });
      mockUpdateDoc.mockResolvedValue(undefined);
      await addCollaborator('list-abc' as any, 'alice@example.com');
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).collaboratorUids._type).toBe('arrayUnion');
      expect((patch as any).collaboratorUids.args).toContain('uid-alice');
    });
  });

  describe('removeCollaborator', () => {
    it('arrayRemoves the uid', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await removeCollaborator('list-abc' as any, 'uid-alice');
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).collaboratorUids._type).toBe('arrayRemove');
    });
  });

  describe('leaveList', () => {
    it('arrayRemoves selfUid', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await leaveList('list-abc' as any, 'uid-self');
      const [, patch] = mockUpdateDoc.mock.calls[0]!;
      expect((patch as any).collaboratorUids._type).toBe('arrayRemove');
      expect((patch as any).collaboratorUids.args).toContain('uid-self');
    });
  });

  describe('subscribeUserLists', () => {
    it('returns an unsubscribe function', () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);
      const result = subscribeUserLists('uid-owner', vi.fn());
      expect(typeof result).toBe('function');
    });
  });
});
