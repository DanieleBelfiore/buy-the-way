/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { List } from '@/domain/types';
import { FIXTURE_LISTS } from '@/dev/fixtures';
import { useAuthStore } from './auth';

interface ListsStoreApi {
  readonly all: Ref<readonly List[]>;
  readonly active: ComputedRef<readonly List[]>;
  readonly trash: ComputedRef<readonly List[]>;
  readonly getById: ComputedRef<(id: ULID) => List | undefined>;
  create: (name: string) => ULID;
  rename: (id: ULID, name: string) => void;
  softDelete: (id: ULID) => void;
  restore: (id: ULID) => void;
  addCollaborator: (listId: ULID, uid: string) => void;
  removeCollaborator: (listId: ULID, uid: string) => void;
  leave: (listId: ULID, selfUid: string) => void;
  reset: () => void;
}

const FALLBACK_OWNER = 'mock-uid';

const cloneFixtures = (): List[] =>
  FIXTURE_LISTS.map((l) => ({
    ...l,
    collaboratorUids: [...l.collaboratorUids],
  }));

const replaceById = (
  source: readonly List[],
  id: ULID,
  patch: (list: List) => List,
): readonly List[] => source.map((l) => (l.id === id ? patch(l) : l));

/**
 * In-memory catalogue of every {@link List} the current user can see (owned
 * or collaborator). The reactive `all` array drives both the active shelf and
 * the Trash view via the `active`/`trash` getters.
 */
export const useListsStore = defineStore('lists', (): ListsStoreApi => {
  const all: Ref<readonly List[]> = ref(cloneFixtures());

  const active = computed<readonly List[]>(() => all.value.filter((l) => l.deletedAt === null));
  const trash = computed<readonly List[]>(() => all.value.filter((l) => l.deletedAt !== null));
  const getById = computed(
    () =>
      (id: ULID): List | undefined =>
        all.value.find((l) => l.id === id),
  );

  const create = (name: string): ULID => {
    const auth = useAuthStore();
    const ownerUid = auth.currentUser?.uid ?? FALLBACK_OWNER;
    const now = Date.now();
    const id = newId();
    const fresh: List = {
      id,
      name,
      ownerUid,
      collaboratorUids: [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    all.value = [fresh, ...all.value];
    return id;
  };

  const touch = (list: List): List => ({ ...list, updatedAt: Date.now() });

  const rename = (id: ULID, name: string): void => {
    all.value = replaceById(all.value, id, (l) => ({ ...touch(l), name }));
  };

  const softDelete = (id: ULID): void => {
    all.value = replaceById(all.value, id, (l) => ({
      ...touch(l),
      deletedAt: Date.now(),
    }));
  };

  const restore = (id: ULID): void => {
    all.value = replaceById(all.value, id, (l) => ({
      ...touch(l),
      deletedAt: null,
    }));
  };

  const addCollaborator = (listId: ULID, uid: string): void => {
    all.value = replaceById(all.value, listId, (l) =>
      l.collaboratorUids.includes(uid)
        ? l
        : {
            ...touch(l),
            collaboratorUids: [...l.collaboratorUids, uid],
          },
    );
  };

  const removeCollaborator = (listId: ULID, uid: string): void => {
    all.value = replaceById(all.value, listId, (l) => ({
      ...touch(l),
      collaboratorUids: l.collaboratorUids.filter((c) => c !== uid),
    }));
  };

  const leave = (listId: ULID, selfUid: string): void => {
    removeCollaborator(listId, selfUid);
  };

  const reset = (): void => {
    all.value = cloneFixtures();
  };

  return {
    all,
    active,
    trash,
    getById,
    create,
    rename,
    softDelete,
    restore,
    addCollaborator,
    removeCollaborator,
    leave,
    reset,
  };
});
