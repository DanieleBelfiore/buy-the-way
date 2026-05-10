/* eslint-disable no-unused-vars */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { newId } from '@/domain/id';
import type { ULID } from '@/domain/id';
import type { List } from '@/domain/types';
import { FIXTURE_LISTS } from '@/dev/fixtures';
import { useAuthStore } from './auth';
import {
  createList as createListSvc,
  renameList as renameListSvc,
  softDeleteList as softDeleteListSvc,
  restoreList as restoreListSvc,
  addCollaboratorByUid as addCollaboratorByUidSvc,
  removeCollaborator as removeCollaboratorSvc,
  leaveList as leaveListSvc,
  subscribeUserLists,
} from '@/services/lists.service';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === '1';

interface ListsStoreApi {
  readonly all: Ref<readonly List[]>;
  readonly active: ComputedRef<readonly List[]>;
  readonly trash: ComputedRef<readonly List[]>;
  readonly getById: ComputedRef<(id: ULID) => List | undefined>;
  readonly loading: Ref<boolean>;
  readonly error: Ref<string | null>;
  subscribe: (uid: string) => () => void;
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
  FIXTURE_LISTS.map((l) => ({ ...l, collaboratorUids: [...l.collaboratorUids] }));

const replaceById = (
  source: readonly List[],
  id: ULID,
  patch: (list: List) => List,
): readonly List[] => source.map((l) => (l.id === id ? patch(l) : l));

export const useListsStore = defineStore('lists', (): ListsStoreApi => {
  const all: Ref<readonly List[]> = ref(USE_FIXTURES ? cloneFixtures() : []);
  const loading = ref(false);
  const error: Ref<string | null> = ref(null);

  const active = computed<readonly List[]>(() => all.value.filter((l) => l.deletedAt === null));
  const trash = computed<readonly List[]>(() => all.value.filter((l) => l.deletedAt !== null));
  const getById = computed(
    () =>
      (id: ULID): List | undefined =>
        all.value.find((l) => l.id === id),
  );

  let _unsub: (() => void) | null = null;

  const subscribe = (uid: string): (() => void) => {
    if (USE_FIXTURES) return () => {};
    _unsub?.();
    loading.value = true;
    _unsub = subscribeUserLists(uid, (lists) => {
      all.value = lists;
      loading.value = false;
    });
    return () => {
      _unsub?.();
      _unsub = null;
    };
  };

  const touch = (list: List): List => ({ ...list, updatedAt: Date.now() });

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
    if (USE_FIXTURES) {
      all.value = [fresh, ...all.value];
    } else {
      createListSvc(fresh).catch((e) => {
        error.value = String(e);
      });
    }
    return id;
  };

  const rename = (id: ULID, name: string): void => {
    if (USE_FIXTURES) {
      all.value = replaceById(all.value, id, (l) => ({ ...touch(l), name }));
    } else {
      renameListSvc(id, name).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const softDelete = (id: ULID): void => {
    if (USE_FIXTURES) {
      all.value = replaceById(all.value, id, (l) => ({ ...touch(l), deletedAt: Date.now() }));
    } else {
      softDeleteListSvc(id).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const restore = (id: ULID): void => {
    if (USE_FIXTURES) {
      all.value = replaceById(all.value, id, (l) => ({ ...touch(l), deletedAt: null }));
    } else {
      restoreListSvc(id).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const addCollaborator = (listId: ULID, uid: string): void => {
    if (USE_FIXTURES) {
      all.value = replaceById(all.value, listId, (l) =>
        l.collaboratorUids.includes(uid)
          ? l
          : { ...touch(l), collaboratorUids: [...l.collaboratorUids, uid] },
      );
    } else {
      addCollaboratorByUidSvc(listId, uid).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const removeCollaborator = (listId: ULID, uid: string): void => {
    if (USE_FIXTURES) {
      all.value = replaceById(all.value, listId, (l) => ({
        ...touch(l),
        collaboratorUids: l.collaboratorUids.filter((c) => c !== uid),
      }));
    } else {
      removeCollaboratorSvc(listId, uid).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const leave = (listId: ULID, selfUid: string): void => {
    if (USE_FIXTURES) {
      removeCollaborator(listId, selfUid);
    } else {
      leaveListSvc(listId, selfUid).catch((e) => {
        error.value = String(e);
      });
    }
  };

  const reset = (): void => {
    _unsub?.();
    _unsub = null;
    all.value = USE_FIXTURES ? cloneFixtures() : [];
    loading.value = false;
    error.value = null;
  };

  return {
    all,
    active,
    trash,
    getById,
    loading,
    error,
    subscribe,
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
