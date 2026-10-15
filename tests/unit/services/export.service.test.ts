import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocsMock = vi.fn();
const getDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts: string[]) => ({ __path: parts.join('/') })),
  doc: vi.fn((_db, ...parts: string[]) => ({ __path: parts.join('/'), id: parts.at(-1) })),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  query: vi.fn((ref) => ref),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  limit: vi.fn((n: number) => ({ __limit: n })),
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: 'db' },
}));

import {
  buildExportPayload
} from '@/services/export.service';

const UID = 'uid-self';

const mockProfileTopLevel = {
  exists: () => true,
  id: UID,
  data: () => ({ uid: UID, email: 'a@b.com', displayName: 'A' }),
};
const mockPrivateState = {
  exists: () => true,
  data: () => ({ lastLoginAt: 999, defaultListId: 'L1' }),
};

describe('export.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildExportPayload', () => {
    it('aggregates profile + lists (with items + favoriteState + history) + catalog into a single payload', async () => {
      // getUserProfile reads top-level + private/state in parallel
      getDocMock
        .mockResolvedValueOnce(mockProfileTopLevel)
        .mockResolvedValueOnce(mockPrivateState);

      // getDocs is called for: user lists, catalog, then per-list items + favoriteState + history.
      getDocsMock.mockImplementation(async (ref: { __path?: string }) => {
        const path = ref?.__path ?? '';
        if (path === 'lists') {
          return {
            docs: [
              {
                id: 'L1',
                data: () => ({
                  id: 'L1',
                  name: 'Family',
                  ownerUid: UID,
                  collaboratorUids: [UID],
                  createdAt: 1,
                  updatedAt: 2,
                }),
              },
            ],
          };
        }
        if (path === `catalog/${UID}/entries`) {
          return {
            docs: [
              {
                id: 'e1',
                data: () => ({
                  id: 'e1', ownerUid: UID, name: 'Milk', category: 'dairy',
                  usageCount: 5, lastUsedAt: 100,
                }),
              },
            ],
          };
        }
        if (path === 'lists/L1/items') {
          return {
            docs: [
              {
                id: 'I1',
                data: () => ({
                  id: 'I1', listId: 'L1', name: 'Bread', quantity: '1',
                  category: 'bakery', note: '', checked: false,
                  createdByUid: UID, createdAt: 1, updatedAt: 1,
                }),
              },
            ],
          };
        }
        if (path === 'lists/L1/favoriteState') {
          return {
            docs: [
              {
                id: 'milk',
                data: () => ({
                  slug: 'milk', name: 'Milk', category: 'dairy',
                  usageCount: 3, lastUsedAt: 100, pinned: true,
                }),
              },
            ],
          };
        }
        if (path === 'lists/L1/history') {
          return {
            docs: [
              {
                id: 'H1',
                data: () => ({
                  id: 'H1',
                  listId: 'L1',
                  completedAt: 500,
                  itemCount: 1,
                  recordedByUid: UID,
                  trigger: 'completion',
                  items: [],
                }),
              },
            ],
          };
        }
        return { docs: [] };
      });

      const out = await buildExportPayload(UID);

      expect(out.schemaVersion).toBe(1);
      expect(out.exportedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(out.profile?.uid).toBe(UID);
      // Private fields merged from subcollection via getUserProfile.
      expect(out.profile?.defaultListId).toBe('L1');
      expect(out.lists).toHaveLength(1);
      expect(out.lists[0].list.id).toBe('L1');
      expect(out.lists[0].items).toHaveLength(1);
      expect(out.lists[0].items[0].name).toBe('Bread');
      expect(out.lists[0].favoriteState).toHaveLength(1);
      expect(out.lists[0].favoriteState[0].slug).toBe('milk');
      expect(out.lists[0].history).toHaveLength(1);
      expect(out.lists[0].history[0].trigger).toBe('completion');
      expect(out.catalog).toHaveLength(1);
      expect(out.catalog[0].name).toBe('Milk');
    });

    it('only fetches per-list bundles for lists the user has access to (array-contains query)', async () => {
      getDocMock
        .mockResolvedValueOnce(mockProfileTopLevel)
        .mockResolvedValueOnce(mockPrivateState);
      getDocsMock.mockImplementation(async (ref: { __path?: string }) => {
        if (ref?.__path === 'lists') return { docs: [] };
        return { docs: [] };
      });

      await buildExportPayload(UID);
      const { where, limit } = await import('firebase/firestore');
      expect(where).toHaveBeenCalledWith('collaboratorUids', 'array-contains', UID);
      expect(limit).toHaveBeenCalledWith(100);
    });
  });
});
