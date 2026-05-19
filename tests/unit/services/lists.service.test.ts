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

import {
  createList,
  subscribeUserLists,
  capitalizeListName,
  DuplicateListNameError,
} from '@/services/lists.service';
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
      });
      expect(data).not.toHaveProperty('deletedAt');
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

    it('rejects when existingNames contains case-insensitive trim match', async () => {
      await expect(createList('  Spesa  ', 'uid-1', ['SPESA'])).rejects.toThrow(DuplicateListNameError);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not reject when existingNames has only different names', async () => {
      await expect(createList('Spesa', 'uid-1', ['Lavoro', 'Casa'])).resolves.toBeTypeOf('string');
    });

    it('trims input name before writing', async () => {
      await createList('  Spesa  ', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Spesa');
    });

    it('capitalizes the first letter when input is lowercase', async () => {
      await createList('spesa', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Spesa');
    });

    it('preserves capitalization beyond the first letter', async () => {
      await createList('iPhone shopping', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('IPhone shopping');
    });

    it('handles unicode initials', async () => {
      await createList('über shop', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('Über shop');
    });

    it('treats whitespace-only name as duplicate of empty (no write skipped beyond existing logic)', async () => {
      await createList('  ', 'uid-1');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as any).name).toBe('');
    });
  });

  describe('capitalizeListName', () => {
    it('uppercases the first letter', () => {
      expect(capitalizeListName('spesa')).toBe('Spesa');
    });

    it('leaves already-capitalized name alone', () => {
      expect(capitalizeListName('Spesa')).toBe('Spesa');
    });

    it('trims surrounding whitespace', () => {
      expect(capitalizeListName('  spesa  ')).toBe('Spesa');
    });

    it('returns empty string for blank input', () => {
      expect(capitalizeListName('   ')).toBe('');
    });

    it('leaves non-letter initials alone', () => {
      expect(capitalizeListName('123 lista')).toBe('123 lista');
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
