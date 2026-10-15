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
  setUserDefaultList,
  getUsersByUids,
  migrateLegacyPrivateFields,
  deletePrivateState
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

    it('normalizes input (trim + lowercase) before query', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ profile: null }),
      } as any);

      await findUserByEmail('  TEST@Example.COM  ');
      
      expect(global.fetch).toHaveBeenCalledOnce();
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain('email=test%40example.com');
    });
  });

  describe('getUsersByUids', () => {
    it('deduplicates uids, uses per-uid getDoc (C3-compatible), and returns only public fields', async () => {
      // The C3 hardening sets `allow list: if false` on /users, so cross-user
      // enumeration via `documentId() in [...]` queries is denied. This helper
      // therefore fans out parallel `getDoc` calls (each is a `get`, which the
      // rules permit) and must strip any legacy private fields the docs still
      // carry from before the schema split.
      vi.mocked(getDoc).mockImplementation((ref: any) => {
        const id = ref?.id;
        if (id === 'a') {
          return Promise.resolve({
            exists: () => true,
            id: 'a',
            data: () => ({
              uid: 'a',
              email: 'a@x',
              displayName: 'A',
              lastLoginAt: 999, // legacy private - must NOT leak
              lastSeenLists: 12345, // legacy private - must NOT leak
              defaultListId: 'L1', // legacy private - must NOT leak
              photoURL: 'https://x/a.png',
            }),
          }) as any;
        }
        return Promise.resolve({ exists: () => false }) as any;
      });
      const { doc } = await import('firebase/firestore');
      vi.mocked(doc).mockImplementation((_db: any, _col: any, uid: string) => ({ id: uid }) as any);

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

  describe('getUserProfile (C3 schema split: private subcollection takes precedence)', () => {
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
  });

  describe('setUserDefaultList', () => {
    it('writes defaultListId to the private subcollection (C3, never to public top-level)', async () => {
      await setUserDefaultList('uid-1', 'L1');
      expect(setDoc).toHaveBeenCalledOnce();
      const [, data, opts] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toEqual({ defaultListId: 'L1' });
      expect(opts).toMatchObject({ merge: true });
    });
  });

  describe('migrateLegacyPrivateFields (C3 one-shot migration)', () => {
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
    it('swallows errors so a missing doc does not block account-delete', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('not-found'));
      await expect(deletePrivateState('u')).resolves.toBeUndefined();
      warn.mockRestore();
    });
  });
});
