import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'users' }),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  documentId: vi.fn().mockReturnValue({ type: 'documentId' }),
  limit: vi.fn().mockReturnValue({ type: 'limit' }),
  getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
  getDoc: vi.fn(),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn().mockReturnValue({ __op: 'deleteField' }),
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
  setUserDefaultList,
  getUsersByUids,
  migrateLegacyPrivateFields,
  deletePrivateState,
} from '@/services/users.service';
import { getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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

    it('throws on empty input (caller-level bug, not a "no match" case)', async () => {
      await expect(findUserByEmail('')).rejects.toThrow(/empty email/);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws on whitespace-only input', async () => {
      await expect(findUserByEmail('   ')).rejects.toThrow(/empty email/);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws on non-2xx HTTP response (distinct from "no match")', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 500 } as any);
      await expect(findUserByEmail('a@b.com')).rejects.toThrow(/HTTP 500/);
    });

    it('throws on network failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));
      await expect(findUserByEmail('a@b.com')).rejects.toThrow(/offline/);
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

    it('deduplicates uids, batches with documentId() in [...] (I2 chunked), and only returns public fields (C3 hardening)', async () => {
      // I2: getUsersByUids now uses a single chunked getDocs query per ≤30 uids
      // instead of one getDoc per uid. C3: even if the docs in Firestore still
      // carry legacy private fields (lastLoginAt > 0, lastSeenLists, …), the
      // helper must strip them from the returned profile.
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          {
            id: 'a',
            data: () => ({
              uid: 'a',
              email: 'a@x',
              displayName: 'A',
              lastLoginAt: 999, // legacy private — must NOT leak
              lastSeenLists: 12345, // legacy private — must NOT leak
              defaultListId: 'L1', // legacy private — must NOT leak
              photoURL: 'https://x/a.png',
            }),
          },
        ],
      } as any);

      const out = await getUsersByUids(['a', 'a', 'missing']);
      expect(out).toHaveLength(1);
      expect(out[0].uid).toBe('a');
      expect(out[0].email).toBe('a@x');
      expect(out[0].displayName).toBe('A');
      expect(out[0].photoURL).toBe('https://x/a.png');
      // PII fields must be stripped even when present on the underlying doc.
      expect(out[0].lastLoginAt).toBe(0);
      expect((out[0] as any).lastSeenLists).toBeUndefined();
      expect((out[0] as any).defaultListId).toBeUndefined();
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

  describe('getUserProfile (C3 schema split: private subcollection takes precedence)', () => {
    it('merges public top-level fields with private subcollection state', async () => {
      // First getDoc call is the top-level doc, second is the private/state doc.
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'uid-1',
          data: () => ({ uid: 'uid-1', email: 'a@b.com', displayName: 'A' }),
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            lastLoginAt: 999,
            lastSeenLists: 100,
            lastSeenListMap: { L1: 5 },
            defaultListId: 'L1',
          }),
        } as any);
      const out = await getUserProfile('uid-1');
      expect(out).toEqual({
        uid: 'uid-1',
        email: 'a@b.com',
        displayName: 'A',
        lastLoginAt: 999,
        lastSeenLists: 100,
        lastSeenListMap: { L1: 5 },
        defaultListId: 'L1',
      });
    });

    it('private subcollection value wins over legacy top-level value', async () => {
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'uid-1',
          data: () => ({
            uid: 'uid-1', email: 'a@b.com', displayName: 'A',
            lastLoginAt: 1, defaultListId: 'OLD',
          }),
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ lastLoginAt: 999, defaultListId: 'NEW' }),
        } as any);
      const out = await getUserProfile('uid-1');
      expect(out?.lastLoginAt).toBe(999);
      expect(out?.defaultListId).toBe('NEW');
    });

    it('falls back to legacy top-level values when subcollection missing', async () => {
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'uid-1',
          data: () => ({
            uid: 'uid-1', email: 'a@b.com', displayName: 'A',
            lastLoginAt: 42, defaultListId: 'L-legacy',
          }),
        } as any)
        .mockResolvedValueOnce({ exists: () => false } as any);
      const out = await getUserProfile('uid-1');
      expect(out?.lastLoginAt).toBe(42);
      expect(out?.defaultListId).toBe('L-legacy');
    });
  });

  describe('setUserDefaultList', () => {
    it('writes defaultListId to the private subcollection (C3, never to public top-level)', async () => {
      await setUserDefaultList('uid-1', 'L1');
      expect(setDoc).toHaveBeenCalledOnce();
      const [, data, opts] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toEqual({ defaultListId: 'L1' });
      expect(opts).toMatchObject({ merge: true });
    });

    it('accepts null to clear the default', async () => {
      await setUserDefaultList('uid-1', null);
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toEqual({ defaultListId: null });
    });
  });

  describe('migrateLegacyPrivateFields (C3 one-shot migration)', () => {
    it('no-ops when top-level doc has no legacy private fields', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ uid: 'u', email: 'a@b', displayName: 'A' }),
      } as any);
      const out = await migrateLegacyPrivateFields('u');
      expect(out).toEqual([]);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('no-ops when top-level doc does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any);
      const out = await migrateLegacyPrivateFields('u');
      expect(out).toEqual([]);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('copies legacy keys to private/state then strips them from top-level via deleteField', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u', email: 'a@b', displayName: 'A',
          lastLoginAt: 7, defaultListId: 'L1',
        }),
      } as any);
      const keys = await migrateLegacyPrivateFields('u');
      expect(keys.sort()).toEqual(['defaultListId', 'lastLoginAt']);
      // Two setDoc calls: copy-to-private (merge:true) + strip-from-public (merge:true).
      expect(setDoc).toHaveBeenCalledTimes(2);
      const payloads = vi.mocked(setDoc).mock.calls.map((c) => c[1]);
      // First payload: real values copied to private/state.
      expect(payloads[0]).toEqual({ lastLoginAt: 7, defaultListId: 'L1' });
      // Second payload: deleteField markers stripping the same keys from public.
      expect(Object.keys(payloads[1] as Record<string, unknown>).sort())
        .toEqual(['defaultListId', 'lastLoginAt']);
    });
  });

  describe('deletePrivateState', () => {
    it('deletes the private/state doc', async () => {
      await deletePrivateState('u');
      expect(deleteDoc).toHaveBeenCalledOnce();
    });

    it('swallows errors so a missing doc does not block account-delete', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('not-found'));
      await expect(deletePrivateState('u')).resolves.toBeUndefined();
      warn.mockRestore();
    });
  });

  describe('findUserByEmail (FindUserError typed — I8)', () => {
    let originalFetch: typeof global.fetch;
    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn();
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('exposes a typed FindUserError with code=empty_email on blank input', async () => {
      const { FindUserError } = await import('@/services/users.service');
      try {
        await findUserByEmail('');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(FindUserError);
        expect((err as InstanceType<typeof FindUserError>).code).toBe('empty_email');
      }
    });

    it('exposes a typed FindUserError with code=http on non-2xx response', async () => {
      const { FindUserError } = await import('@/services/users.service');
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as any);
      try {
        await findUserByEmail('a@b.com');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(FindUserError);
        expect((err as InstanceType<typeof FindUserError>).code).toBe('http');
      }
    });

    it('exposes a typed FindUserError with code=transport on fetch rejection', async () => {
      const { FindUserError } = await import('@/services/users.service');
      vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));
      try {
        await findUserByEmail('a@b.com');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(FindUserError);
        expect((err as InstanceType<typeof FindUserError>).code).toBe('transport');
      }
    });
  });
});
