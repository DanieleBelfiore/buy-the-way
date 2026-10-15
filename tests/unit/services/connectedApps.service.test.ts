import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getIdToken = vi.fn();
let currentUser: { getIdToken: typeof getIdToken } | null = null;

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path: string) => ({ path })),
  query: vi.fn((col, ...constraints) => ({ col, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: {} }));

import { getDocs, where } from 'firebase/firestore';
import {
  revokeConnectedApp,
  revokeAllConnectedApps,
  ConnectedAppsError
} from '@/services/connectedApps.service';

const fetchMock = vi.fn();

describe('connectedApps.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    currentUser = { getIdToken };
    getIdToken.mockResolvedValue('id-tok');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('revokeConnectedApp', () => {
    it('treats an already-gone grant (404) as done', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
      await expect(revokeConnectedApp('G1')).resolves.toBeUndefined();
    });

  });

  describe('revokeAllConnectedApps', () => {
    it('revokes every grant of the user (account deletion)', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [{ id: 'G1' }, { id: 'G2' }] } as never);
      fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
      await revokeAllConnectedApps('me');
      expect(where).toHaveBeenCalledWith('uid', '==', 'me');
      const ids = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).grantId).sort();
      expect(ids).toEqual(['G1', 'G2']);
    });

    it('fails when any revocation fails', async () => {
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [{ id: 'G1' }] } as never);
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
      await expect(revokeAllConnectedApps('me')).rejects.toBeInstanceOf(ConnectedAppsError);
    });
  });
});
