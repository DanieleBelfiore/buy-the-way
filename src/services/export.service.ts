import {
  collection,
  getDocs,
  query,
  where,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getUserProfile } from '@/services/users.service';
import { USER_LISTS_PAGE_LIMIT } from '@/services/lists.service';
import type { CatalogEntry, Item, List, ListFavoriteState, UserProfile } from '@/domain/types';
import pkg from '../../package.json';

/**
 * GDPR right-to-portability export.
 *
 * Aggregates every piece of data the signed-in user has access to into a
 * single JSON document, then returns it as a Blob the caller can hand to
 * an `<a download>` element.
 *
 * Scope:
 *  - public profile (users/{uid})
 *  - private state (users/{uid}/private/state) - merged with public into
 *    the same `profile` object via `getUserProfile`
 *  - every list the user collaborates on (lists where
 *    collaboratorUids array-contains uid)
 *  - items + favoriteState subcollections of each list
 *  - the user's personal catalog (catalog/{uid}/entries)
 *
 * Deliberately does NOT include other collaborators' private state. Lists
 * surface collaborator UIDs (already visible to the caller via the list
 * doc) but no foreign activity metadata.
 */

export interface ExportedListBundle {
  /** Snapshot of the list doc - includes collaboratorUids, admins, etc. */
  list: List;
  items: Item[];
  favoriteState: ListFavoriteState[];
}

export interface UserDataExport {
  /** ISO timestamp of when the export was produced. */
  exportedAt: string;
  /** App version (from package.json) so future schema changes are traceable. */
  appVersion: string;
  schemaVersion: 1;
  profile: UserProfile | null;
  lists: ExportedListBundle[];
  catalog: CatalogEntry[];
}

const fetchListBundle = async (list: List): Promise<ExportedListBundle> => {
  const itemsCol = collection(db, 'lists', list.id, 'items');
  const favsCol = collection(db, 'lists', list.id, 'favoriteState');
  const [itemsSnap, favsSnap] = await Promise.all([getDocs(itemsCol), getDocs(favsCol)]);
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
  const favoriteState = favsSnap.docs.map(
    (d) => ({ slug: d.id, ...d.data() }) as ListFavoriteState,
  );
  return { list, items, favoriteState };
};

const fetchCatalog = async (uid: string): Promise<CatalogEntry[]> => {
  const entriesCol = collection(db, 'catalog', uid, 'entries');
  const snap = await getDocs(entriesCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CatalogEntry);
};

const fetchUserLists = async (uid: string): Promise<List[]> => {
  const q = query(
    collection(db, 'lists'),
    where('collaboratorUids', 'array-contains', uid),
    fbLimit(USER_LISTS_PAGE_LIMIT),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as List);
};

/**
 * Build the export object for `uid`. Pure aggregation - no DOM access,
 * so this is unit-testable against a mocked firestore.
 */
export const buildExportPayload = async (uid: string): Promise<UserDataExport> => {
  const [profile, lists, catalog] = await Promise.all([
    getUserProfile(uid),
    fetchUserLists(uid),
    fetchCatalog(uid),
  ]);
  // Pull items + favorites for each list in parallel. List count matches the
  // realtime subscription cap (USER_LISTS_PAGE_LIMIT); items per list are
  // unbounded (grocery lists stay small in practice).
  const bundles = await Promise.all(lists.map(fetchListBundle));
  return {
    exportedAt: new Date().toISOString(),
    appVersion: pkg.version,
    schemaVersion: 1,
    profile,
    lists: bundles,
    catalog,
  };
};

/**
 * Hand-off helper: aggregates and returns a `Blob` ready to be wired into
 * an `<a download>` element. The caller controls the filename; this layer
 * just produces the bytes.
 */
export const exportUserData = async (uid: string): Promise<Blob> => {
  const payload = await buildExportPayload(uid);
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
};

/** Returns a filename like `buy-the-way-export-2026-05-25.json`. */
export const defaultExportFilename = (now: Date = new Date()): string => {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `buy-the-way-export-${yyyy}-${mm}-${dd}.json`;
};

/**
 * Convenience trigger: builds the blob and hands it to the browser as a
 * download. Returns the filename used so the caller can surface it in a
 * toast.
 */
export const downloadUserDataExport = async (
  uid: string,
  filename: string = defaultExportFilename(),
): Promise<string> => {
  const blob = await exportUserData(uid);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
  return filename;
};
