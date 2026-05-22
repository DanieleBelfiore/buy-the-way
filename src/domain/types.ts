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
  ownerUid: string;
  collaboratorUids: readonly string[];
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
  pinned?: boolean;
  excluded?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt: number;
  lastSeenLists?: number;
  /**
   * Optional list ID the user wants opened automatically when the app boots.
   * `null` (or absent) means no default — user lands on the lists overview.
   */
  defaultListId?: string | null;
}
