import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => ({
    path: args.slice(1).join('/'),
    id: args[args.length - 1],
  })),
  collection: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  auth: { currentUser: null as null | { uid: string; delete: () => Promise<void> } },
  db: { __mock: 'db' },
}));

vi.mock('@/services/lists.service', () => ({
  deleteList: vi.fn().mockResolvedValue(undefined),
  leaveList: vi.fn().mockResolvedValue(undefined),
  transferListOwnership: vi.fn().mockResolvedValue(undefined),
}));

import {
  deleteAccount,
  RequiresRecentLoginError,
  PartialDeletionError,
} from '@/services/auth.service';
import {
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth } from '@/services/firebase';
import { deleteList, leaveList, transferListOwnership } from '@/services/lists.service';

const mGetDocs = vi.mocked(getDocs);
const mDeleteDoc = vi.mocked(deleteDoc);
const mWriteBatch = vi.mocked(writeBatch);
const mDeleteList = vi.mocked(deleteList);
const mLeaveList = vi.mocked(leaveList);
const mTransfer = vi.mocked(transferListOwnership);

const makeListDocs = (ids: { id: string; ownerUid: string; collaboratorUids: string[] }[]) => ({
  docs: ids.map((d) => ({ id: d.id, data: () => ({ id: d.id, ownerUid: d.ownerUid, collaboratorUids: d.collaboratorUids }) })),
});

const makeEntryDocs = (count: number) => ({
  docs: Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    ref: { id: `e${i}` },
  })),
});

describe('auth.service.deleteAccount', () => {
  const UID = 'uid-self';
  let firebaseDelete: ReturnType<typeof vi.fn>;
  let batchDelete: ReturnType<typeof vi.fn>;
  let batchCommit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseDelete = vi.fn().mockResolvedValue(undefined);
    (auth as unknown as { currentUser: unknown }).currentUser = {
      uid: UID,
      delete: firebaseDelete,
    };
    batchDelete = vi.fn();
    batchCommit = vi.fn().mockResolvedValue(undefined);
    mWriteBatch.mockReturnValue({ delete: batchDelete, commit: batchCommit } as never);

    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([]) as never;
    });
  });

  it('throws when no current user', async () => {
    (auth as unknown as { currentUser: unknown }).currentUser = null;
    await expect(deleteAccount(UID)).rejects.toThrow();
  });

  it('cascades: solo-owned lists → deleteList, non-owned → leaveList, catalog purged, user doc deleted, then firebase user delete', async () => {
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(2) as never;
      return makeListDocs([
        { id: 'L1', ownerUid: UID, collaboratorUids: [UID] },
        { id: 'L2', ownerUid: 'other', collaboratorUids: ['other', UID] },
      ]) as never;
    });

    await deleteAccount(UID);

    expect(mDeleteList).toHaveBeenCalledWith('L1');
    expect(mLeaveList).toHaveBeenCalledWith('L2', UID);
    expect(mTransfer).not.toHaveBeenCalled();
    expect(batchDelete).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalled();
    const userDeleteCalls = mDeleteDoc.mock.calls.filter(
      ([ref]) => (ref as { path?: string }).path?.includes(`users/${UID}`),
    );
    expect(userDeleteCalls.length).toBeGreaterThan(0);
    expect(firebaseDelete).toHaveBeenCalledOnce();
  });

  it('transfers ownership to next collaborator when owned list is shared', async () => {
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([
        { id: 'L1', ownerUid: UID, collaboratorUids: [UID, 'bob', 'carl'] },
      ]) as never;
    });

    await deleteAccount(UID);

    expect(mTransfer).toHaveBeenCalledWith('L1', UID, 'bob');
    expect(mDeleteList).not.toHaveBeenCalled();
    expect(firebaseDelete).toHaveBeenCalledOnce();
  });

  it('mixes transfer + delete + leave across lists', async () => {
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([
        { id: 'L-solo', ownerUid: UID, collaboratorUids: [UID] },
        { id: 'L-shared', ownerUid: UID, collaboratorUids: [UID, 'bob'] },
        { id: 'L-guest', ownerUid: 'other', collaboratorUids: ['other', UID] },
      ]) as never;
    });

    await deleteAccount(UID);

    expect(mDeleteList).toHaveBeenCalledWith('L-solo');
    expect(mTransfer).toHaveBeenCalledWith('L-shared', UID, 'bob');
    expect(mLeaveList).toHaveBeenCalledWith('L-guest', UID);
  });

  it('throws PartialDeletionError and skips auth-user delete when transferListOwnership fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mTransfer.mockRejectedValueOnce(new Error('boom'));
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([
        { id: 'L1', ownerUid: UID, collaboratorUids: [UID, 'bob'] },
      ]) as never;
    });

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(PartialDeletionError);

    expect(mTransfer).toHaveBeenCalled();
    expect(firebaseDelete).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws PartialDeletionError when one of many deleteList calls fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mDeleteList.mockRejectedValueOnce(new Error('boom'));
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([
        { id: 'L1', ownerUid: UID, collaboratorUids: [UID] },
        { id: 'L2', ownerUid: UID, collaboratorUids: [UID] },
      ]) as never;
    });

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(PartialDeletionError);

    expect(mDeleteList).toHaveBeenCalledTimes(2);
    expect(firebaseDelete).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws PartialDeletionError when leaveList fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mLeaveList.mockRejectedValueOnce(new Error('boom'));
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(0) as never;
      return makeListDocs([
        { id: 'L2', ownerUid: 'other', collaboratorUids: ['other', UID] },
      ]) as never;
    });

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(PartialDeletionError);

    expect(mLeaveList).toHaveBeenCalled();
    expect(firebaseDelete).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws PartialDeletionError when catalog purge fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    batchCommit.mockRejectedValueOnce(new Error('catalog boom'));
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(3) as never;
      return makeListDocs([]) as never;
    });

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(PartialDeletionError);
    expect(firebaseDelete).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws PartialDeletionError when user-doc delete fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mDeleteDoc.mockRejectedValueOnce(new Error('userdoc boom'));
    mGetDocs.mockImplementation(async () => makeListDocs([]) as never);

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(PartialDeletionError);
    expect(firebaseDelete).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws RequiresRecentLoginError when firebase delete throws requires-recent-login', async () => {
    firebaseDelete.mockRejectedValue(
      Object.assign(new Error('reauth'), { code: 'auth/requires-recent-login' }),
    );

    await expect(deleteAccount(UID)).rejects.toBeInstanceOf(RequiresRecentLoginError);
  });

  it('propagates non-recent-login auth errors as-is', async () => {
    firebaseDelete.mockRejectedValue(
      Object.assign(new Error('other'), { code: 'auth/network-request-failed' }),
    );

    await expect(deleteAccount(UID)).rejects.toThrow('other');
  });

  it('batches catalog deletes into chunks of 500', async () => {
    mGetDocs.mockImplementation(async (q: unknown) => {
      const path = (q as { path?: string }).path ?? '';
      if (path.includes('catalog')) return makeEntryDocs(750) as never;
      return makeListDocs([]) as never;
    });

    await deleteAccount(UID);

    expect(mWriteBatch).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(2);
    expect(batchDelete).toHaveBeenCalledTimes(750);
  });
});
