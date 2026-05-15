import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'lists' }),
  doc: vi.fn().mockReturnValue({ id: 'mock-doc' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(),
  query: vi.fn().mockReturnValue({ type: 'query' }),
  where: vi.fn().mockReturnValue({ type: 'where' }),
  orderBy: vi.fn().mockReturnValue({ type: 'orderBy' }),
}));

import { createList, subscribeUserLists } from '@/services/lists.service';
import { setDoc, onSnapshot } from 'firebase/firestore';

describe('lists.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
  });

  describe('createList', () => {
    it('writes a list doc via setDoc', async () => {
      await createList('Spesa', 'uid-1');
      expect(setDoc).toHaveBeenCalledOnce();
    });

    it('includes required fields in the list doc', async () => {
      await createList('Spesa', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({
        name: 'Spesa',
        ownerUid: 'uid-1',
        collaboratorUids: ['uid-1'],
        deletedAt: null,
      });
      expect(typeof (data as any).createdAt).toBe('number');
      expect(typeof (data as any).updatedAt).toBe('number');
    });

    it('returns a 26-char ULID id', async () => {
      const id = await createList('Latte', 'uid-1');
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(26);
    });

    it('sets id in the doc matching the returned id', async () => {
      const id = await createList('Latte', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).id).toBe(id);
    });
  });

  describe('subscribeUserLists', () => {
    it('returns an unsubscribe function', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      const unsub = subscribeUserLists('uid-1', vi.fn(), vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('calls onSnapshot with a query', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      subscribeUserLists('uid-1', vi.fn(), vi.fn());
      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('maps snapshot docs to List objects and calls onChange', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_q, onNext: any, _onError: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });

      const onChange = vi.fn();
      subscribeUserLists('uid-1', onChange, vi.fn());

      capturedNext!({
        docs: [
          {
            id: '01ABCDEFGH01234567890ABC12',
            data: () => ({
              name: 'Spesa',
              ownerUid: 'uid-1',
              collaboratorUids: ['uid-1'],
              deletedAt: null,
              createdAt: 100,
              updatedAt: 200,
            }),
          },
        ],
      });

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toHaveLength(1);
      expect(onChange.mock.calls[0][0][0]).toMatchObject({
        id: '01ABCDEFGH01234567890ABC12',
        name: 'Spesa',
        ownerUid: 'uid-1',
      });
    });

    it('calls onError on snapshot error', () => {
      vi.mocked(onSnapshot).mockImplementation((_q, _onNext: any, onError: any) => {
        onError(new Error('permission-denied'));
        return vi.fn() as any;
      });

      const onError = vi.fn();
      subscribeUserLists('uid-1', vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
