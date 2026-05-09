import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { useListsStore } from '@/stores/lists';

describe('stores/lists', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.signOut();
    auth.signIn();
  });

  it('seeds active and trash from fixtures', () => {
    const lists = useListsStore();
    expect(lists.active.length).toBeGreaterThanOrEqual(3);
    expect(lists.trash.length).toBeGreaterThanOrEqual(1);
    expect(lists.active.every((l) => l.deletedAt === null)).toBe(true);
    expect(lists.trash.every((l) => l.deletedAt !== null)).toBe(true);
  });

  it('create returns a ULID and prepends a fresh list owned by the current user', () => {
    const lists = useListsStore();
    const before = lists.active.length;
    const id = lists.create('Spesa di prova');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(lists.active.length).toBe(before + 1);
    const created = lists.getById(id);
    expect(created).toBeDefined();
    expect(created?.name).toBe('Spesa di prova');
    expect(created?.ownerUid).toBe('mock-uid');
    expect(created?.collaboratorUids).toEqual([]);
    expect(created?.deletedAt).toBeNull();
  });

  it('rename mutates updatedAt and the name', async () => {
    const lists = useListsStore();
    const id = lists.create('Old');
    const created = lists.getById(id);
    const oldUpdated = created?.updatedAt ?? 0;
    await new Promise((r) => setTimeout(r, 2));
    lists.rename(id, 'New');
    const after = lists.getById(id);
    expect(after?.name).toBe('New');
    expect(after?.updatedAt).toBeGreaterThan(oldUpdated);
  });

  it('softDelete moves a list to trash and restore moves it back', () => {
    const lists = useListsStore();
    const id = lists.create('Temp');
    expect(lists.active.find((l) => l.id === id)).toBeDefined();
    lists.softDelete(id);
    expect(lists.active.find((l) => l.id === id)).toBeUndefined();
    expect(lists.trash.find((l) => l.id === id)).toBeDefined();
    lists.restore(id);
    expect(lists.active.find((l) => l.id === id)).toBeDefined();
    expect(lists.trash.find((l) => l.id === id)).toBeUndefined();
  });

  it('addCollaborator appends a uid and is idempotent', () => {
    const lists = useListsStore();
    const id = lists.create('Shared');
    lists.addCollaborator(id, 'uid-x');
    lists.addCollaborator(id, 'uid-x');
    expect(lists.getById(id)?.collaboratorUids).toEqual(['uid-x']);
    lists.addCollaborator(id, 'uid-y');
    expect(lists.getById(id)?.collaboratorUids).toEqual(['uid-x', 'uid-y']);
  });

  it('removeCollaborator drops a uid and is a no-op when absent', () => {
    const lists = useListsStore();
    const id = lists.create('Shared');
    lists.addCollaborator(id, 'uid-x');
    lists.addCollaborator(id, 'uid-y');
    lists.removeCollaborator(id, 'uid-x');
    expect(lists.getById(id)?.collaboratorUids).toEqual(['uid-y']);
    lists.removeCollaborator(id, 'uid-missing');
    expect(lists.getById(id)?.collaboratorUids).toEqual(['uid-y']);
  });

  it('leave removes the current user from a shared list', () => {
    const lists = useListsStore();
    const id = lists.create('Group');
    lists.addCollaborator(id, 'uid-self');
    lists.addCollaborator(id, 'uid-other');
    lists.leave(id, 'uid-self');
    expect(lists.getById(id)?.collaboratorUids).toEqual(['uid-other']);
  });

  it('getById returns undefined for an unknown id', () => {
    const lists = useListsStore();
    expect(lists.getById('01HXXXXXXXXXXXXXXXXXXXXXX0' as never)).toBeUndefined();
  });
});
