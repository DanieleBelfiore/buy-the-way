import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'users' }),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  limit: vi.fn().mockReturnValue({ type: 'limit' }),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn().mockReturnValue({ __t: 'server' }),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({ 
    currentUser: { 
      uid: 'mock-uid',
      getIdToken: vi.fn().mockResolvedValue('mock-token')
    } 
  }),
}));

import {
  findUserByEmail,
  getUserProfile,
  touchLastSeenLists,
  touchLastSeenList,
  getUsersByUids,
} from '@/services/users.service';
import { getDoc, getDocs, query, where, limit, setDoc } from 'firebase/firestore';

describe('users.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findUserByEmail', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns null on empty input', async () => {
      const out = await findUserByEmail('');
      expect(out).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on whitespace-only input', async () => {
      const out = await findUserByEmail('   ');
      expect(out).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('normalizes input (trim + lowercase) before query', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ profile: null }),
      } as any);

      await findUserByEmail('  TEST@Example.COM  ');
      
      expect(global.fetch).toHaveBeenCalledOnce();
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain('email=test%40example.com');
    });

    it('returns null when no match found', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ profile: null }),
      } as any);

      const out = await findUserByEmail('nobody@example.com');
      expect(out).toBeNull();
    });

    it('returns UserProfile when match found', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: {
            uid: 'uid-1',
            email: 'a@b.com',
            displayName: 'A',
            lastLoginAt: 123,
          },
        }),
      } as any);

      const out = await findUserByEmail('a@b.com');
      expect(out).toEqual({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 123,
      });
    });

    it('matches case-insensitively (uppercase input)', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          profile: {
            uid: 'uid-2',
            email: 'foo@bar.com',
            displayName: 'Foo',
            lastLoginAt: 99,
          },
        }),
      } as any);

      const out = await findUserByEmail('FOO@BAR.COM');
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain('email=foo%40bar.com');
      expect(out?.uid).toBe('uid-2');
    });
  });

  describe('getUserProfile', () => {
    it('returns null when doc missing', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      const out = await getUserProfile('uid-x');
      expect(out).toBeNull();
    });

    it('returns profile when doc exists', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'uid-1',
        data: () => ({
          uid: 'uid-1',
          email: 'a@b.com',
          displayName: 'A',
          lastLoginAt: 50,
          lastSeenLists: 100,
        }),
      } as any);
      const out = await getUserProfile('uid-1');
      expect(out).toEqual({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 50,
        lastSeenLists: 100,
      });
    });
  });

  describe('getUsersByUids', () => {
    it('returns empty array on empty input', async () => {
      const out = await getUsersByUids([]);
      expect(out).toEqual([]);
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('deduplicates uids and skips missing docs', async () => {
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        const id = ref?.id;
        if (id === 'a') {
          return Promise.resolve({
            exists: () => true,
            id: 'a',
            data: () => ({ uid: 'a', email: 'a@x', displayName: 'A', lastLoginAt: 0 }),
          }) as any;
        }
        return Promise.resolve({ exists: () => false }) as any;
      });
      vi.mocked(setDoc).mockClear();
      const { doc } = await import('firebase/firestore');
      vi.mocked(doc).mockImplementation((_db: any, _col: any, uid: string) => ({ id: uid }) as any);

      const out = await getUsersByUids(['a', 'a', 'missing']);
      expect(out).toHaveLength(1);
      expect(out[0].uid).toBe('a');
    });
  });

  describe('touchLastSeenLists', () => {
    it('writes lastSeenLists with merge', async () => {
      await touchLastSeenLists('uid-7', 1700000000);
      expect(setDoc).toHaveBeenCalledOnce();
      const [, data, opts] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({ lastSeenLists: 1700000000 });
      expect(opts).toMatchObject({ merge: true });
    });

    it('defaults to current time when no timestamp given', async () => {
      const before = Date.now();
      await touchLastSeenLists('uid-7');
      const after = Date.now();
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).lastSeenLists).toBeGreaterThanOrEqual(before);
      expect((data as any).lastSeenLists).toBeLessThanOrEqual(after);
    });
  });

  describe('touchLastSeenList (per-list)', () => {
    it('writes lastSeenListMap entry under listId with merge', async () => {
      await touchLastSeenList('uid-1', 'list-A', 1700000000);
      expect(setDoc).toHaveBeenCalledOnce();
      const [, data, opts] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toEqual({ lastSeenListMap: { 'list-A': 1700000000 } });
      expect(opts).toMatchObject({ merge: true });
    });

    it('defaults to current time when no timestamp given', async () => {
      const before = Date.now();
      await touchLastSeenList('uid-1', 'list-A');
      const after = Date.now();
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      const ts = (data as any).lastSeenListMap['list-A'];
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('getUserProfile (lastSeenListMap passthrough)', () => {
    it('includes lastSeenListMap when present in the doc', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'uid-1',
        data: () => ({
          uid: 'uid-1',
          email: 'a@b.com',
          displayName: 'A',
          lastLoginAt: 50,
          lastSeenListMap: { 'list-A': 1000, 'list-B': 2000 },
        }),
      } as any);
      const out = await getUserProfile('uid-1');
      expect(out?.lastSeenListMap).toEqual({ 'list-A': 1000, 'list-B': 2000 });
    });

    it('omits lastSeenListMap key entirely when absent', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'uid-1',
        data: () => ({
          uid: 'uid-1',
          email: 'a@b.com',
          displayName: 'A',
          lastLoginAt: 50,
        }),
      } as any);
      const out = await getUserProfile('uid-1');
      expect(out).not.toHaveProperty('lastSeenListMap');
    });
  });
});
