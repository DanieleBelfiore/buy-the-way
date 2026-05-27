import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { newId } from '@/domain/id';
import { findUserByEmail } from '@/services/users.service';
import { isWallpaper, pickRandomWallpaper } from '@/domain/wallpapers';
import { capitalizeInitial } from '@/domain/text';
import { notifyListEvent } from '@/services/notify.service';
import { purgeItemPhotoStorage } from '@/services/itemPhotos.service';
import type { Category, List, UserProfile } from '@/domain/types';

export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`No registered user with email: ${email}`);
    this.name = 'UserNotFoundError';
  }
}

export class CannotRemoveOwnerError extends Error {
  constructor() {
    super('The list owner cannot be removed');
    this.name = 'CannotRemoveOwnerError';
  }
}

export class ListNotFoundError extends Error {
  constructor(listId: string) {
    super(`List not found: ${listId}`);
    this.name = 'ListNotFoundError';
  }
}

export class DuplicateListNameError extends Error {
  constructor(name: string) {
    super(`A list named "${name}" already exists`);
    this.name = 'DuplicateListNameError';
  }
}

export class InvalidWallpaperError extends Error {
  constructor(value: string) {
    super(`Invalid wallpaper filename: ${value}`);
    this.name = 'InvalidWallpaperError';
  }
}

export class LastAdminError extends Error {
  constructor() {
    super('A list must keep at least one admin');
    this.name = 'LastAdminError';
  }
}

export class NotACollaboratorError extends Error {
  constructor(uid: string) {
    super(`User ${uid} is not a collaborator on this list`);
    this.name = 'NotACollaboratorError';
  }
}

const normalizeListName = (name: string): string => name.trim().toLowerCase();

export const capitalizeListName = capitalizeInitial;

export const createList = async (
  name: string,
  ownerUid: string,
  existingNames: readonly string[] = [],
): Promise<string> => {
  const formatted = capitalizeListName(name);
  const target = normalizeListName(formatted);
  if (target && existingNames.some((n) => normalizeListName(n) === target)) {
    throw new DuplicateListNameError(formatted);
  }
  const id = newId();
  const now = Date.now();
  const listData: List = {
    id,
    name: formatted,
    ownerUid,
    collaboratorUids: [ownerUid],
    admins: [ownerUid],
    itemCount: 0,
    urgentCount: 0,
    wallpaper: pickRandomWallpaper(),
    // S3.4: seed with `now` so newly created lists float to the top of the
    // user's overview by default. User-driven reorders override this.
    sortIndex: now,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, 'lists', id), listData);
  return id;
};

/** Put the pinned (default) list first; leave relative order of the rest. */
export const orderListsWithDefaultFirst = (
  lists: readonly List[],
  defaultListId: string | null | undefined,
): List[] => {
  if (!defaultListId) return [...lists];
  const pinned = lists.find((l) => l.id === defaultListId);
  if (!pinned) return [...lists];
  return [pinned, ...lists.filter((l) => l.id !== defaultListId)];
};

/**
 * S3.4: update a list's sortIndex. Used by drag-and-drop reorder.
 * Higher sortIndex sorts earlier; callers compute the target value based
 * on neighbouring rows (midpoint between neighbors keeps inserts cheap).
 */
export const reorderList = async (
  listId: string,
  sortIndex: number,
): Promise<void> => {
  await updateDoc(doc(db, 'lists', listId), {
    sortIndex,
    updatedAt: Date.now(),
  });
};

/**
 * Persist the per-list category ordering preference. The full new order is
 * sent (no per-row index math) - category sets are tiny (≤10) so the doc
 * stays well under any size cap.
 */
export const setListCategoryOrder = async (
  listId: string,
  order: readonly Category[],
): Promise<void> => {
  await updateDoc(doc(db, 'lists', listId), {
    categoryOrder: [...order],
    updatedAt: Date.now(),
  });
};

/**
 * Pure helper for the drag-and-drop reorder math. Given the post-move array
 * and the moved row's new index, returns the sortIndex value to persist.
 *
 * Strategy: midpoint between the new neighbours. If only one neighbour
 * exists (edge of the list), step one above/below it. With no neighbours
 * (single-list case), fall back to current time so concurrent edits don't
 * collide.
 */
export const computeReorderedSortIndex = (
  ordered: ReadonlyArray<List>,
  newIndex: number,
  now: number = Date.now(),
): number => {
  if (newIndex < 0 || newIndex >= ordered.length) return now;
  const above = ordered[newIndex - 1];
  const below = ordered[newIndex + 1];
  const aboveIdx = above?.sortIndex ?? above?.updatedAt;
  const belowIdx = below?.sortIndex ?? below?.updatedAt;

  if (aboveIdx !== undefined && belowIdx !== undefined) {
    let target = Math.floor((aboveIdx + belowIdx) / 2);
    if (target >= aboveIdx) target = aboveIdx - 1;
    if (target <= belowIdx) target = belowIdx + 1;
    return target;
  }
  if (aboveIdx !== undefined) return aboveIdx - 1;
  if (belowIdx !== undefined) return belowIdx + 1;
  return now;
};

export const setListWallpaper = async (
  listId: string,
  wallpaper: string,
): Promise<void> => {
  if (!isWallpaper(wallpaper)) throw new InvalidWallpaperError(wallpaper);
  await updateDoc(doc(db, 'lists', listId), {
    wallpaper,
    updatedAt: Date.now(),
  });
};

// Upper bound on the number of lists a single user can see in one snapshot.
// 100 covers any reasonable household; past that, the UI virtualises and we
// can wire pagination if a real user ever hits the cap.
export const USER_LISTS_PAGE_LIMIT = 100;

export const subscribeUserLists = (
  uid: string,
  onChange: (lists: List[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  // S3.4: sort by `updatedAt desc` on the server. The user-controlled
  // `sortIndex` is applied client-side after the snapshot arrives so we
  // don't have to deploy a second composite index just for sorted reads;
  // tiebreak on `updatedAt` keeps deterministic ordering when two lists
  // share the same sortIndex (e.g. legacy docs with no sortIndex at all).
  const q = query(
    collection(db, 'lists'),
    where('collaboratorUids', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
    fbLimit(USER_LISTS_PAGE_LIMIT),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as List,
      );
      // Stable secondary sort by sortIndex (falling back to updatedAt so
      // legacy docs land in their original updatedAt-driven order).
      const sorted = [...raw].sort((a, b) => {
        const ai = a.sortIndex ?? a.updatedAt;
        const bi = b.sortIndex ?? b.updatedAt;
        if (bi !== ai) return bi - ai;
        return b.updatedAt - a.updatedAt;
      });
      onChange(sorted);
    },
    (error) => onError(error as Error),
  );
};

export interface AddCollaboratorResult {
  /** Registered user that was matched, if any. */
  profile: UserProfile | null;
  /** Whether the invite is queued because the email isn't registered yet. */
  pending: boolean;
  /** Normalized (trimmed + lowercased) email used for the invite. */
  email: string;
}

const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const addCollaborator = async (
  listId: string,
  email: string,
): Promise<AddCollaboratorResult> => {
  const normalized = normalizeEmail(email);
  const profile = await findUserByEmail(normalized);

  if (profile) {
    // Registered: add the uid directly. Also remove any prior pending entry
    // for the same email (rare, but possible if the user just signed up).
    await updateDoc(doc(db, 'lists', listId), {
      collaboratorUids: arrayUnion(profile.uid),
      pendingInviteEmails: arrayRemove(normalized),
      updatedAt: Date.now(),
    });
    // S4.1: notify the existing collaborators that the list has a new
    // member. The server templates the body from `targetUid` (reading the
    // new collaborator's displayName itself - we never pass strings).
    void notifyListEvent({
      listId,
      kind: 'collaborator-added',
      targetUid: profile.uid,
    });
    return { profile, pending: false, email: normalized };
  }

  // Not registered yet - queue the invite. The auth-side claim step will
  // promote this to a real collaboratorUid when the user signs up.
  await updateDoc(doc(db, 'lists', listId), {
    pendingInviteEmails: arrayUnion(normalized),
    updatedAt: Date.now(),
  });
  return { profile: null, pending: true, email: normalized };
};

/**
 * Migrate pending email invites into real collaborator entries.
 *
 * Called after sign-in: looks up every list where the user's email is in
 * `pendingInviteEmails`, swaps it for their uid in `collaboratorUids`, and
 * removes the email from the pending array.
 *
 * Failures are logged but never thrown - the user can still use the app
 * without their pending lists, and the claim retries on the next sign-in.
 */
export const claimPendingInvites = async (
  uid: string,
  email: string,
): Promise<number> => {
  const normalized = normalizeEmail(email);
  if (!normalized) return 0;

  try {
    const q = query(
      collection(db, 'lists'),
      where('pendingInviteEmails', 'array-contains', normalized),
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    let claimed = 0;
    await Promise.all(
      snap.docs.map(async (d) => {
        try {
          await updateDoc(doc(db, 'lists', d.id), {
            collaboratorUids: arrayUnion(uid),
            pendingInviteEmails: arrayRemove(normalized),
            updatedAt: Date.now(),
          });
          claimed += 1;
        } catch (err) {
          console.warn(`[claimPendingInvites] failed for ${d.id}:`, err);
        }
      }),
    );
    return claimed;
  } catch (err) {
    console.warn('[claimPendingInvites] query failed:', err);
    return 0;
  }
};

export const cancelPendingInvite = async (
  listId: string,
  email: string,
): Promise<void> => {
  const normalized = normalizeEmail(email);
  await updateDoc(doc(db, 'lists', listId), {
    pendingInviteEmails: arrayRemove(normalized),
    updatedAt: Date.now(),
  });
};

const loadListOwner = async (listId: string): Promise<string> => {
  const snap = await getDoc(doc(db, 'lists', listId));
  if (!snap.exists()) throw new ListNotFoundError(listId);
  return (snap.data() as List).ownerUid;
};

export const removeCollaborator = async (
  listId: string,
  uid: string,
): Promise<void> => {
  const ownerUid = await loadListOwner(listId);
  if (uid === ownerUid) throw new CannotRemoveOwnerError();

  // Drop from collaborators AND admins in one write so the doc never holds
  // an admin uid that's no longer a collaborator.
  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayRemove(uid),
    admins: arrayRemove(uid),
    updatedAt: Date.now(),
  });
};

export const leaveList = async (listId: string, selfUid: string): Promise<void> => {
  const ownerUid = await loadListOwner(listId);
  if (selfUid === ownerUid) throw new CannotRemoveOwnerError();

  await updateDoc(doc(db, 'lists', listId), {
    collaboratorUids: arrayRemove(selfUid),
    admins: arrayRemove(selfUid),
    updatedAt: Date.now(),
  });
};

export const renameList = async (listId: string, name: string): Promise<void> => {
  const formatted = capitalizeListName(name);
  if (!formatted) throw new Error('List name cannot be empty');
  await updateDoc(doc(db, 'lists', listId), {
    name: formatted,
    updatedAt: Date.now(),
  });
};

export const transferListOwnership = async (
  listId: string,
  oldOwnerUid: string,
  newOwnerUid: string,
): Promise<void> => {
  if (oldOwnerUid === newOwnerUid) {
    throw new Error('Cannot transfer ownership to the same user');
  }
  // Move ownerUid to the new user and sync the admins set: promote the new
  // owner if they weren't already an admin, drop the old owner from admins
  // alongside the collaborator removal. Keeps invariant "ownerUid in admins".
  await updateDoc(doc(db, 'lists', listId), {
    ownerUid: newOwnerUid,
    collaboratorUids: arrayRemove(oldOwnerUid),
    admins: arrayUnion(newOwnerUid),
    updatedAt: Date.now(),
  });
  await updateDoc(doc(db, 'lists', listId), {
    admins: arrayRemove(oldOwnerUid),
    updatedAt: Date.now(),
  });
};

const loadListSnapshot = async (
  listId: string,
): Promise<Pick<List, 'ownerUid' | 'collaboratorUids' | 'admins'>> => {
  const snap = await getDoc(doc(db, 'lists', listId));
  if (!snap.exists()) throw new ListNotFoundError(listId);
  const data = snap.data() as List;
  return {
    ownerUid: data.ownerUid,
    collaboratorUids: data.collaboratorUids,
    admins: data.admins,
  };
};

const adminsOf = (list: Pick<List, 'ownerUid' | 'admins'>): readonly string[] =>
  list.admins ?? [list.ownerUid];

/**
 * Promote a collaborator to admin. Requires the target to be an existing
 * collaborator on the list. Idempotent: promoting an already-admin user is a
 * no-op write that bumps updatedAt.
 */
export const promoteAdmin = async (
  listId: string,
  targetUid: string,
): Promise<void> => {
  const snap = await loadListSnapshot(listId);
  if (!snap.collaboratorUids.includes(targetUid)) {
    throw new NotACollaboratorError(targetUid);
  }
  await updateDoc(doc(db, 'lists', listId), {
    admins: arrayUnion(targetUid),
    updatedAt: Date.now(),
  });
};

/**
 * Demote an admin back to plain collaborator. Throws `LastAdminError` if the
 * removal would leave the list with no admins. If the demoted user is the
 * current `ownerUid`, ownership transfers (lexicographically) to another
 * remaining admin to preserve the "ownerUid points at an active admin"
 * invariant relied on by cascade-delete code paths.
 */
export const demoteAdmin = async (
  listId: string,
  targetUid: string,
): Promise<void> => {
  const snap = await loadListSnapshot(listId);
  const current = [...adminsOf(snap)];
  if (!current.includes(targetUid)) return; // Already not an admin - no-op.
  const remaining = current.filter((u) => u !== targetUid);
  if (remaining.length === 0) throw new LastAdminError();

  if (snap.ownerUid === targetUid) {
    // Pivot ownerUid to the lexicographically-first remaining admin so the
    // doc never points at a non-admin (cascade-delete depends on this).
    const nextOwner = [...remaining].sort()[0]!;
    await updateDoc(doc(db, 'lists', listId), {
      ownerUid: nextOwner,
      admins: arrayRemove(targetUid),
      updatedAt: Date.now(),
    });
  } else {
    await updateDoc(doc(db, 'lists', listId), {
      admins: arrayRemove(targetUid),
      updatedAt: Date.now(),
    });
  }
};

const DELETE_BATCH_SIZE = 500;

export const deleteList = async (listId: string): Promise<void> => {
  // I1: Storage cascade has to run BEFORE the list doc disappears, because
  // `storage.rules` consult the parent list's collaboratorUids to authorise
  // deletes. After this step the items + list doc go in whatever order.
  let itemIdsWithPhotos: string[] = [];
  try {
    const itemsCol = collection(db, 'lists', listId, 'items');
    const snap = await getDocs(itemsCol);
    itemIdsWithPhotos = snap.docs
      .filter((d) => {
        const data = d.data() as { photoURL?: string; thumbURL?: string };
        return Boolean(data.photoURL || data.thumbURL);
      })
      .map((d) => d.id);
    await Promise.all(
      itemIdsWithPhotos.map((id) =>
        purgeItemPhotoStorage(listId, id).catch((err) => {
          console.warn('[lists] deleteList: storage cascade failed for', id, err);
        }),
      ),
    );
  } catch (err) {
    console.warn('[lists] deleteList: photo discovery failed (continuing):', err);
  }

  // Delete the list document so a mid-cascade failure leaves orphan items
  // that are unreachable via the UI (no parent list to navigate to) rather
  // than a list doc that appears intact but is half-emptied.
  await deleteDoc(doc(db, 'lists', listId));

  try {
    const itemsCol = collection(db, 'lists', listId, 'items');
    const snap = await getDocs(itemsCol);
    const ids = snap.docs.map((d) => d.id);
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const chunk = ids.slice(i, i + DELETE_BATCH_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) batch.delete(doc(itemsCol, id));
      await batch.commit();
    }
  } catch (err) {
    console.warn('[lists] deleteList: cascade item delete failed (list doc already gone):', err);
  }
};

/** Fix denormalized urgentCount when it drifted (legacy docs, missed writes). */
export const reconcileListUrgentCount = async (
  listId: string,
  urgentCount: number,
  storedUrgentCount = 0,
): Promise<void> => {
  if (storedUrgentCount === urgentCount) return;
  await updateDoc(doc(db, 'lists', listId), {
    urgentCount,
    updatedAt: Date.now(),
  });
};
