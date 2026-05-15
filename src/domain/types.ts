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
  collaboratorUids: readonly string[];
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id: ULID;
  listId: ULID;
  name: string;
  quantity: string;
  category: Category;
  note: string;
  checked: boolean;
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

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  lastLoginAt: number;
}
