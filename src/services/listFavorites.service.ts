import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { normalizeName } from '@/domain/public-catalog';
import type { ULID } from '@/domain/id';
import type { Category, ListFavoriteState } from '@/domain/types';

const slugFor = (name: string): string => normalizeName(name);

export const subscribeListFavorites = (
  listId: ULID,
  onChange: (entries: ListFavoriteState[]) => void,
  onError: (err: Error) => void,
): (() => void) => {
  const col = collection(db, 'lists', listId, 'favoriteState');
  return onSnapshot(
    col,
    (snap) => {
      const entries = snap.docs.map(
        (d) => ({ slug: d.id, ...d.data() }) as ListFavoriteState,
      );
      onChange(entries);
    },
    (error) => onError(error as Error),
  );
};

/**
 * Increment per-list usage on item add. Creates the doc if it doesn't exist.
 * Always merges so existing pinned/excluded/dismissedFavorite flags survive.
 */
export const upsertListFavorite = async (
  listId: ULID,
  name: string,
  category: Category,
): Promise<void> => {
  const slug = slugFor(name);
  const col = collection(db, 'lists', listId, 'favoriteState');
  const ref = doc(col, slug);
  const snap = await getDoc(ref);
  const now = Date.now();
  if (snap.exists()) {
    await updateDoc(ref, {
      usageCount: increment(1),
      lastUsedAt: now,
      // Keep canonical name/category in sync with the latest add (e.g. user
      // corrects capitalization or category via item edit later on).
      name,
      category,
    });
  } else {
    const entry: ListFavoriteState = {
      slug,
      name,
      category,
      usageCount: 1,
      lastUsedAt: now,
    };
    await setDoc(ref, entry);
  }
};

export const setListFavoriteExcluded = async (
  listId: ULID,
  slug: string,
  excluded: boolean,
): Promise<void> => {
  const ref = doc(db, 'lists', listId, 'favoriteState', slug);
  const patch: Record<string, unknown> = { excluded };
  if (excluded) patch.pinned = false;
  await updateDoc(ref, patch);
};

/**
 * Toggle the favorite state for a list entry.
 *
 * `wantFavorite = true`  → explicit pin, clear any dismissal/exclusion.
 * `wantFavorite = false` → stop showing in this list's favorites shelf without
 * suppressing the entry from autocomplete suggestions (uses the sticky
 * `dismissedFavorite` flag so usage-count auto-promotion stays off).
 */
export const setListFavoriteState = async (
  listId: ULID,
  slug: string,
  wantFavorite: boolean,
): Promise<void> => {
  const ref = doc(db, 'lists', listId, 'favoriteState', slug);
  const patch: Record<string, unknown> = wantFavorite
    ? { pinned: true, dismissedFavorite: false, excluded: false }
    : { pinned: false, dismissedFavorite: true };
  await updateDoc(ref, patch);
};

export const findListFavoriteByName = async (
  listId: ULID,
  name: string,
): Promise<ListFavoriteState | null> => {
  const slug = slugFor(name);
  const ref = doc(db, 'lists', listId, 'favoriteState', slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { slug, ...snap.data() } as ListFavoriteState;
};

/**
 * Ensure a per-list favorite doc exists for `name` and return its slug. If
 * the doc is missing (legacy list, or a row whose source row was created
 * before per-list favorites shipped) a fresh doc is created with
 * `usageCount: 0` - distinct from `upsertListFavorite`, which is the
 * add-item path and bumps the count. Use this when the user is acting on
 * the favorite directly (e.g. tapping the star) without adding a new row.
 */
/** Update canonical name/category on an existing favorite doc (no usage bump). */
export const patchListFavorite = async (
  listId: ULID,
  slug: string,
  patch: { name: string; category: Category },
): Promise<void> => {
  const ref = doc(db, 'lists', listId, 'favoriteState', slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, patch);
};

export const ensureListFavorite = async (
  listId: ULID,
  name: string,
  category: Category,
): Promise<string> => {
  const slug = slugFor(name);
  const ref = doc(db, 'lists', listId, 'favoriteState', slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const entry: ListFavoriteState = {
      slug,
      name,
      category,
      usageCount: 0,
      lastUsedAt: Date.now(),
    };
    await setDoc(ref, entry);
  } else {
    await updateDoc(ref, { name, category });
  }
  return slug;
};
