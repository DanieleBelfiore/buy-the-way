import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchCommit = vi.fn().mockResolvedValue(undefined);
const batchDelete = vi.fn();
const writeBatchMock = vi.fn(() => ({ delete: batchDelete, commit: batchCommit }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'notifications' }),
  doc: vi.fn().mockImplementation((_col, id) => ({ id })),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
  onSnapshot: vi.fn(),
  writeBatch: () => writeBatchMock(),
  getDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  db: { __type: 'mock-db' },
}));

import {
  subscribeNotifications,
  deleteNotifications,
  deleteAllNotifications,
} from '@/services/notifications.service';
import { onSnapshot, getDocs } from 'firebase/firestore';

describe('notifications.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeNotifications', () => {
    it('passes through Firestore docs mapped to NotificationDoc shape', () => {
      const listener = vi.fn();
      vi.mocked(onSnapshot).mockImplementation((_q: any, success: any) => {
        success({
          forEach: (fn: (d: any) => void) => {
            fn({ id: 'n1', data: () => ({ kind: 'item-modified', listId: 'L1', listName: 'Spesa', senderUid: 'u2', senderName: 'Bob', locale: 'it', itemName: 'pane', createdAt: 1 }) });
            fn({ id: 'n2', data: () => ({ kind: 'collaborator-added', listId: 'L1', listName: 'Spesa', senderUid: 'u2', senderName: 'Bob', locale: 'en', itemName: 'Carol', createdAt: 2 }) });
          },
        });
        return vi.fn();
      });

      subscribeNotifications('u1', listener);
      expect(listener).toHaveBeenCalledOnce();
      const [items] = listener.mock.calls[0];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ id: 'n1', kind: 'item-modified', listName: 'Spesa' });
      expect(items[1]).toMatchObject({ id: 'n2', kind: 'collaborator-added' });
    });

    it('returns the unsubscribe function from onSnapshot', () => {
      const unsub = vi.fn();
      vi.mocked(onSnapshot).mockReturnValue(unsub);
      const result = subscribeNotifications('u1', vi.fn());
      expect(result).toBe(unsub);
    });

    it('logs subscription errors via the onSnapshot error callback', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(onSnapshot).mockImplementation((_q: any, _success: any, error: any) => {
        error(new Error('boom'));
        return vi.fn();
      });
      subscribeNotifications('u1', vi.fn());
      expect(warn).toHaveBeenCalledWith('[notifications] subscription error:', expect.any(Error));
      warn.mockRestore();
    });
  });

  describe('deleteNotifications', () => {
    it('is a no-op for an empty id list', async () => {
      await deleteNotifications('u1', []);
      expect(writeBatchMock).not.toHaveBeenCalled();
      expect(batchCommit).not.toHaveBeenCalled();
    });

    it('batch-deletes every supplied id in a single commit when under the cap', async () => {
      await deleteNotifications('u1', ['a', 'b', 'c']);
      expect(writeBatchMock).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledTimes(3);
      expect(batchCommit).toHaveBeenCalledOnce();
    });
  });

  describe('deleteAllNotifications', () => {
    it('no-ops when the inbox is already empty', async () => {
      vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);
      await deleteAllNotifications('u1');
      expect(writeBatchMock).not.toHaveBeenCalled();
    });

    it('purges every doc in the inbox via batch delete', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{ id: 'n1' }, { id: 'n2' }],
      } as any);
      await deleteAllNotifications('u1');
      expect(batchDelete).toHaveBeenCalledTimes(2);
      expect(batchCommit).toHaveBeenCalledOnce();
    });

    it('swallows enumeration errors so account-delete cascade is unaffected', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(getDocs).mockRejectedValue(new Error('rules denied'));
      await expect(deleteAllNotifications('u1')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
