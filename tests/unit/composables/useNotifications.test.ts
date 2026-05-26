import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const subscribeMock = vi.fn();
const deleteMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/notifications.service', () => ({
  subscribeNotifications: (uid: string, cb: (items: any[]) => void) =>
    subscribeMock(uid, cb),
  deleteNotifications: (uid: string, ids: string[]) => deleteMock(uid, ids),
}));

import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/composables/useNotifications';

const hostFor = (capture: { api?: ReturnType<typeof useNotifications> } = {}) =>
  defineComponent({
    setup() {
      const api = useNotifications();
      capture.api = api;
      return () => h('div');
    },
  });

describe('useNotifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    subscribeMock.mockReset();
    deleteMock.mockClear();
  });

  it('does not subscribe when there is no signed-in user', () => {
    const capture: { api?: ReturnType<typeof useNotifications> } = {};
    mount(hostFor(capture));
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(capture.api!.count.value).toBe(0);
  });

  it('subscribes on mount when a user is already signed in and mirrors snapshots into items', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' } as any;

    let lastCb: ((items: any[]) => void) | undefined;
    subscribeMock.mockImplementation((_uid: string, cb: (items: any[]) => void) => {
      lastCb = cb;
      return vi.fn();
    });

    const capture: { api?: ReturnType<typeof useNotifications> } = {};
    mount(hostFor(capture));
    expect(subscribeMock).toHaveBeenCalledWith('u1', expect.any(Function));

    lastCb!([
      { id: 'n1', kind: 'item-modified', listId: 'L1', listName: 'X', senderUid: 'u2', senderName: 'B', locale: 'it', createdAt: 1 },
      { id: 'n2', kind: 'collaborator-added', listId: 'L1', listName: 'X', senderUid: 'u2', senderName: 'B', locale: 'en', createdAt: 2 },
    ]);
    await nextTick();
    expect(capture.api!.count.value).toBe(2);
    expect(capture.api!.items.value).toHaveLength(2);
  });

  it('consume() deletes the current snapshot and returns the rows it snapshot', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' } as any;

    let lastCb: ((items: any[]) => void) | undefined;
    subscribeMock.mockImplementation((_uid: string, cb: (items: any[]) => void) => {
      lastCb = cb;
      return vi.fn();
    });

    const capture: { api?: ReturnType<typeof useNotifications> } = {};
    mount(hostFor(capture));

    lastCb!([
      { id: 'n1', kind: 'item-modified', listId: 'L1', listName: 'X', senderUid: 'u2', senderName: 'B', locale: 'it', createdAt: 1 },
    ]);
    await nextTick();

    const consumed = await capture.api!.consume();
    expect(deleteMock).toHaveBeenCalledWith('u1', ['n1']);
    expect(consumed).toHaveLength(1);
    expect(consumed[0]!.id).toBe('n1');
  });

  it('consume() is a no-op when there is no signed-in user', async () => {
    const capture: { api?: ReturnType<typeof useNotifications> } = {};
    mount(hostFor(capture));
    const consumed = await capture.api!.consume();
    expect(consumed).toEqual([]);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('switches subscription when the signed-in uid changes', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' } as any;

    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    subscribeMock
      .mockImplementationOnce(() => unsub1)
      .mockImplementationOnce(() => unsub2);

    const capture: { api?: ReturnType<typeof useNotifications> } = {};
    mount(hostFor(capture));
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    auth.user = { uid: 'u2', email: 'c@d.com', displayName: 'C' } as any;
    await nextTick();
    expect(unsub1).toHaveBeenCalledOnce();
    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect(subscribeMock.mock.calls[1]![0]).toBe('u2');
  });

  it('tears down the subscription on unmount', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1', email: 'a@b.com', displayName: 'A' } as any;
    const unsub = vi.fn();
    subscribeMock.mockReturnValue(unsub);

    const wrapper = mount(hostFor());
    expect(unsub).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });
});
