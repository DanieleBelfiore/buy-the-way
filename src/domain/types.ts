import type { ULID } from './id';

export type Locale = 'it' | 'en';

export type Category =
  | 'fruit_vegetables'
  | 'dairy'
  | 'meat_fish'
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
  collaboratorUids: readonly string[]; // uids resolved via users/{uid} lookup, never emails
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id: ULID;
  listId: ULID;
  name: string;
  quantity: string; // free text: "2", "500g", "1.5l"
  category: Category;
  note: string;
  checked: boolean;
  createdByUid: string;
  createdAt: number;
  updatedAt: number;
}

export interface CatalogEntry {
  id: ULID;
  ownerUid: string; // private per-user
  name: string;
  category: Category;
  usageCount: number;
  lastUsedAt: number;
}

// Firestore document users/{uid}, populated by auth.service on login.
// Required for email -> uid lookup in addCollaborator. No PII beyond what Google provides.
export interface UserProfile {
  uid: string;
  email: string; // lowercase, normalized, indexed
  displayName: string;
  lastLoginAt: number;
}
