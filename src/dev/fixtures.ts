import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { CatalogEntry, Item, List, UserProfile } from '@/domain/types';

const DAY = 86_400_000;
const NOW = Date.now();
const daysAgo = (n: number): number => NOW - n * DAY;

/**
 * Single mock owner used by every fixture document. Mirrors the deterministic
 * profile produced by the mock {@link useAuth} composable so the
 * fixture-backed views render with a stable identity until Phase 4 wires
 * Firebase Auth.
 */
export const FIXTURE_USER: UserProfile = {
  uid: 'mock-uid',
  email: 'mock@example.com',
  displayName: 'Mock User',
  lastLoginAt: NOW,
};

const COLLAB_UID_ALICE = 'uid-alice';
const COLLAB_UID_BRUNO = 'uid-bruno';

const LIST_ID_WEEKLY: ULID = newId();
const LIST_ID_PARTY: ULID = newId();
const LIST_ID_HOUSEHOLD: ULID = newId();
const LIST_ID_DELETED: ULID = newId();

/**
 * Four sample lists matching the design package's ListsView samples; one is
 * soft-deleted so {@link TrashView} renders meaningful state.
 */
export const FIXTURE_LISTS: readonly List[] = [
  {
    id: LIST_ID_WEEKLY,
    name: 'Spesa settimanale',
    ownerUid: FIXTURE_USER.uid,
    collaboratorUids: [COLLAB_UID_ALICE],
    deletedAt: null,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(0),
  },
  {
    id: LIST_ID_PARTY,
    name: 'Festa di sabato',
    ownerUid: FIXTURE_USER.uid,
    collaboratorUids: [COLLAB_UID_ALICE, COLLAB_UID_BRUNO],
    deletedAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    id: LIST_ID_HOUSEHOLD,
    name: 'Casa e pulizie',
    ownerUid: FIXTURE_USER.uid,
    collaboratorUids: [],
    deletedAt: null,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  },
  {
    id: LIST_ID_DELETED,
    name: 'Vecchia spesa',
    ownerUid: FIXTURE_USER.uid,
    collaboratorUids: [],
    deletedAt: daysAgo(5),
    createdAt: daysAgo(40),
    updatedAt: daysAgo(5),
  },
];

const buildItem = (
  listId: ULID,
  name: string,
  category: Item['category'],
  quantity: string,
  checked: boolean,
  ageDays: number,
): Item => ({
  id: newId(),
  listId,
  name,
  quantity,
  category,
  note: '',
  checked,
  createdByUid: FIXTURE_USER.uid,
  createdAt: daysAgo(ageDays),
  updatedAt: daysAgo(ageDays),
});

/**
 * Items keyed by parent list ID. Each non-deleted list has between three and
 * six items spanning multiple categories; the deleted list has none.
 */
export const FIXTURE_ITEMS: Readonly<Record<ULID, readonly Item[]>> = {
  [LIST_ID_WEEKLY]: [
    buildItem(LIST_ID_WEEKLY, 'Mele', 'fruit_vegetables', '1kg', false, 0),
    buildItem(LIST_ID_WEEKLY, 'Latte', 'dairy', '2', false, 0),
    buildItem(LIST_ID_WEEKLY, 'Pane', 'bakery', '1', true, 1),
    buildItem(LIST_ID_WEEKLY, 'Pollo', 'meat_fish', '500g', false, 1),
    buildItem(LIST_ID_WEEKLY, 'Acqua frizzante', 'beverages', '6', false, 0),
    buildItem(LIST_ID_WEEKLY, 'Detersivo piatti', 'cleaning', '1', false, 2),
  ],
  [LIST_ID_PARTY]: [
    buildItem(LIST_ID_PARTY, 'Patatine', 'other', '3', false, 1),
    buildItem(LIST_ID_PARTY, 'Birra', 'beverages', '12', false, 1),
    buildItem(LIST_ID_PARTY, 'Ghiaccio', 'frozen', '2', true, 0),
    buildItem(LIST_ID_PARTY, 'Tovaglioli', 'other', '1', false, 2),
  ],
  [LIST_ID_HOUSEHOLD]: [
    buildItem(LIST_ID_HOUSEHOLD, 'Carta igienica', 'hygiene', '1', false, 2),
    buildItem(LIST_ID_HOUSEHOLD, 'Sapone mani', 'hygiene', '2', false, 2),
    buildItem(LIST_ID_HOUSEHOLD, 'Spugne', 'cleaning', '1', true, 3),
  ],
  [LIST_ID_DELETED]: [],
};

const catalogEntry = (
  name: string,
  category: CatalogEntry['category'],
  usageCount: number,
  ageDays: number,
): CatalogEntry => ({
  id: newId(),
  ownerUid: FIXTURE_USER.uid,
  name,
  category,
  usageCount,
  lastUsedAt: daysAgo(ageDays),
});

/**
 * Roughly thirty catalog entries with varied usage counts and recency so the
 * MostUsedShelf has interesting ranking demos and the autocomplete has rich
 * suggestion candidates.
 */
export const FIXTURE_CATALOG: readonly CatalogEntry[] = [
  catalogEntry('Mele', 'fruit_vegetables', 18, 1),
  catalogEntry('Banane', 'fruit_vegetables', 14, 2),
  catalogEntry('Insalata', 'fruit_vegetables', 9, 4),
  catalogEntry('Pomodori', 'fruit_vegetables', 11, 3),
  catalogEntry('Latte', 'dairy', 24, 0),
  catalogEntry('Yogurt', 'dairy', 12, 2),
  catalogEntry('Burro', 'dairy', 6, 6),
  catalogEntry('Parmigiano', 'dairy', 7, 5),
  catalogEntry('Pollo', 'meat_fish', 10, 3),
  catalogEntry('Tonno', 'meat_fish', 5, 8),
  catalogEntry('Salmone', 'meat_fish', 4, 12),
  catalogEntry('Pane', 'bakery', 22, 1),
  catalogEntry('Cornetti', 'bakery', 6, 7),
  catalogEntry('Grissini', 'bakery', 4, 14),
  catalogEntry('Acqua', 'beverages', 30, 0),
  catalogEntry('Caffè', 'beverages', 16, 4),
  catalogEntry('Vino rosso', 'beverages', 8, 10),
  catalogEntry('Birra', 'beverages', 9, 6),
  catalogEntry('Pizza surgelata', 'frozen', 5, 9),
  catalogEntry('Verdure miste', 'frozen', 3, 18),
  catalogEntry('Gelato', 'frozen', 7, 11),
  catalogEntry('Detersivo piatti', 'cleaning', 8, 5),
  catalogEntry('Sapone bucato', 'cleaning', 5, 9),
  catalogEntry('Spugne', 'cleaning', 4, 12),
  catalogEntry('Carta igienica', 'hygiene', 13, 4),
  catalogEntry('Dentifricio', 'hygiene', 6, 16),
  catalogEntry('Shampoo', 'hygiene', 4, 22),
  catalogEntry('Sale', 'other', 3, 25),
  catalogEntry('Olio oliva', 'other', 9, 3),
  catalogEntry('Zucchero', 'other', 5, 14),
];
