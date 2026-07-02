import type { ULID } from './id';
import type { ListHistoryTrigger } from './history';
import type { ItemAddedVia } from './itemProvenance';

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
   * driven by `admins` - `ownerUid` alone does not grant any privilege beyond
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
  /** Denormalized count of items with priority "urgent". */
  urgentCount?: number;
  wallpaper?: string;
  /**
   * S3.4: user-controlled ordering. Higher value = earlier in the lists
   * overview. Seeded to `createdAt` on list creation so brand-new lists land
   * at the top; legacy docs missing this field fall back to `updatedAt` at
   * read time so they don't all collapse to a single index of 0.
   */
  sortIndex?: number;
  /**
   * Per-list ordering of the category groups inside ListDetailView. Earlier
   * in the array = appears first. Categories present in the items list but
   * absent here fall back to alphabetic order by translated label.
   * Shared across collaborators (lives on the list doc). Any collaborator may
   * update it (see firestore.rules); drag-and-drop in ListDetailView is open
   * to all members, not admin-only.
   */
  categoryOrder?: Category[];
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
  /** Immutable provenance for analytics / future suggest layers. Legacy items may omit. */
  addedVia?: ItemAddedVia;
  /**
   * S4.2: optional photo attachment. Compressed JPEG stored in Firebase
   * Storage at `lists/{listId}/items/{itemId}/photo.jpg`. The download URL
   * is persisted here; thumbURL is a smaller variant for row display.
   */
  photoURL?: string;
  thumbURL?: string;
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
 * Immutable snapshot of a completed (or emptied) shopping run for one list.
 * Stored under `lists/{listId}/history/{historyId}`. Items carry the full
 * live `Item` shape at snapshot time so future suggest/LLM layers can pick
 * fields without a schema migration.
 */
export interface ListHistoryEntry {
  id: ULID;
  listId: ULID;
  completedAt: number;
  itemCount: number;
  recordedByUid: string;
  trigger: ListHistoryTrigger;
  items: Item[];
}

/**
 * Per-list favorite state. Stored under `lists/{listId}/favoriteState/{slug}`
 * with `slug` (normalized name) as the document id. Each list maintains its
 * own usage counts and favorite/exclude/dismiss flags - favorites in list A
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
   * `null` (or absent) means no default - user lands on the lists overview.
   */
  defaultListId?: string | null;
  /**
   * Set to `true` after the user has completed or skipped the onboarding
   * tour. Stored in the private subcollection - not readable by other users.
   * Missing / `false` triggers the tour on the next `/lists` mount.
   */
  onboardingSeen?: boolean;
  /**
   * Lifetime count of shopping runs this user has completed (trigger
   * `completion` only - the empty_fallback snapshot does not count). Bumped
   * atomically via `increment(1)` in the private subcollection so it never
   * leaks through cross-user profile reads. Absent means zero.
   */
  completedShopCount?: number;
  /** Epoch ms of the user's most recent completed shopping run. */
  lastCompletedShopAt?: number;
}

/**
 * S4.2: in-app notification doc. Server-templated (see notify-list-event)
 * and written to `users/{uid}/notifications/{id}`. Render-then-purge: the
 * popover batch-deletes every doc it displays when it opens.
 */
export type NotificationKind = 'item-modified' | 'collaborator-added' | 'collaborator-joined';

export interface NotificationDoc {
  id: string;
  kind: NotificationKind;
  listId: string;
  listName: string;
  senderUid: string;
  senderName: string;
  /** Sender's UI locale at the time of the event - drives popover rendering. */
  locale: 'it' | 'en';
  itemId?: string;
  /**
   * For `item-modified`: the item's name at the time of the event.
   * For `collaborator-added`: the new collaborator's displayName.
   * Used as the second bold slot in the popover body template.
   */
  itemName?: string;
  createdAt: number;
}
