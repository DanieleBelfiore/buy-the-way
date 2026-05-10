import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ auth: {}, db: {} }));

const { mockGetDocs, mockQuery, mockCollection, mockWhere } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: any[]) => args),
  mockCollection: vi.fn((_db: any, path: string) => ({ path })),
  mockWhere: vi.fn((...args: any[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  getDocs: mockGetDocs,
}));

import { findUserByEmail } from '@/services/users.service';

const ALICE = {
  uid: 'uid-alice',
  email: 'alice@example.com',
  displayName: 'Alice',
  lastLoginAt: 0,
};

describe('users.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no user matches the email', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    const result = await findUserByEmail('unknown@example.com');
    expect(result).toBeNull();
  });

  it('returns UserProfile when email matches', async () => {
    mockGetDocs.mockResolvedValue({ empty: false, docs: [{ data: () => ALICE }] });
    const result = await findUserByEmail('alice@example.com');
    expect(result).toEqual(ALICE);
  });

  it('normalizes email to lowercase before querying', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    await findUserByEmail('ALICE@EXAMPLE.COM');
    expect(mockWhere).toHaveBeenCalledWith('email', '==', 'alice@example.com');
  });

  it('throws when Firestore rejects (no swallow)', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));
    await expect(findUserByEmail('x@y.com')).rejects.toThrow('permission-denied');
  });
});
