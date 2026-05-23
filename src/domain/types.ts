import type { ULID } from './id';

export type Locale = 'it' | 'en';

export type Category =
  | 'fruit_vegetables'
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'bakery'
  | 'beverages'
  | 'frozen'
  | 'cleaning'
  | 'hygiene'
  | 'other';

export interface List {
  id: ULID;
  name: string;
  /**
   * Creator-of-record. Kept stable for cascade-delete pivot logic and as a
   * fallback for legacy lists that pre-date `admins`. Permissions are now
   * driven by `admins` — `ownerUid` alone does not grant any privilege beyond
   * what membership in `admins` already implies.
   */
  ownerUid: string;
  collaboratorUids: readonly string[];
  /**
   * UIDs that may rename/wallpaper/delete the list, manage collaborators, and
   * promote/demote other admins. Legacy lists (created before this field
   * existed) MAY be missing it; Firestore rules treat that case as
   * `admins = [ownerUid]`.
   */
  admins?: readonly string[];
  /**
   * Emails (lowercased) of users who were invited but had no account yet.
   * On sign-in, the auth flow matches the user's email here and migrates them
   * into `collaboratorUids`, removing the entry from this list.
   */
  pendingInviteEmails?: readonly string[];
  itemCount?: number;
  showFavorites?: boolean;
  wallpaper?: string;
  createdAt: number;
  updatedAt: number;
}

export type ItemPriority = 'urgent' | 'optional';

export interface Item {
  id: ULID;
  listId: ULID;
  name: string;
  quantity: string;
  category: Category;
  note: string;
  checked: boolean;
  priority?: ItemPriority;
  createdByUid: string;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogEntry {
  id: ULID;
  ownerUid: string;
  name: string;
  category: Category;
  usageCount: number;
  lastUsedAt: number;
}

/**
 * Per-list favorite state. Stored under `lists/{listId}/favoriteState/{slug}`
 * with `slug` (normalized name) as the document id. Each list maintains its
 * own usage counts and favorite/exclude/dismiss flags — favorites in list A
 * are independent of favorites in list B even if both share the same item
 * names.
 */
export interface ListFavoriteState {
  slug: string;
  name: string;
  category: Category;
  usageCount: number;
  lastUsedAt: number;
  pinned?: boolean;
  excluded?: boolean;
  /**
   * Sticky "do not auto-promote to favorites for this list" flag. A dismissed
   * entry still appears in autocomplete suggestions (autocomplete pulls from
   * the global per-user catalog), but is hidden from this list's favorites
   * shelf even when `usageCount` would otherwise qualify.
   */
  dismissedFavorite?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt: number;
  /** @deprecated kept as legacy fallback for the per-list lastSeenListMap migration. */
  lastSeenLists?: number;
  /**
   * Per-list "last seen" timestamps used to drive the per-list NEW badge.
   * Key: list ID. Value: epoch ms of the most recent time the user opened
   * that specific list. Missing key falls back to `lastSeenLists`.
   */
  lastSeenListMap?: Record<string, number>;
  /**
   * Optional list ID the user wants opened automatically when the app boots.
   * `null` (or absent) means no default — user lands on the lists overview.
   */
  defaultListId?: string | null;
}
