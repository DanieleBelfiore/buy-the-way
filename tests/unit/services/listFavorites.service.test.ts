import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ id: 'favoriteState' }),
  doc: vi.fn((..._args: unknown[]) => ({ id: _args[_args.length - 1] })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  increment: vi.fn((n: number) => ({ __increment: n })),
}));

import {
  subscribeListFavorites,
  upsertListFavorite,
  setListFavoriteExcluded,
  setListFavoriteState,
  findListFavoriteByName,
  ensureListFavorite,
} from '@/services/listFavorites.service';
import { setDoc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import type { ULID } from '@/domain/id';
import type { ListFavoriteState } from '@/domain/types';

const listId = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as ULID;

describe('listFavorites.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setDoc).mockResolvedValue(undefined);
    vi.mocked(updateDoc).mockResolvedValue(undefined);
  });

  describe('upsertListFavorite', () => {
    it('creates a new entry via setDoc when the doc does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      await upsertListFavorite(listId, 'Latte', 'dairy');
      expect(setDoc).toHaveBeenCalledOnce();
      expect(updateDoc).not.toHaveBeenCalled();
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({
        slug: 'latte',
        name: 'Latte',
        category: 'dairy',
        usageCount: 1,
      });
      expect(typeof (data as any).lastUsedAt).toBe('number');
    });

    it('normalizes accented names into ASCII slug ids', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      await upsertListFavorite(listId, 'Babà', 'bakery');
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect((data as { slug: string }).slug).toBe('baba');
    });

    it('increments usageCount + bumps lastUsedAt when the doc exists', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as any);
      await upsertListFavorite(listId, 'Latte', 'dairy');
      expect(updateDoc).toHaveBeenCalledOnce();
      expect(setDoc).not.toHaveBeenCalled();
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect((patch as any).usageCount).toEqual({ __increment: 1 });
      expect(typeof (patch as any).lastUsedAt).toBe('number');
    });

    it('refreshes canonical name + category on increment (latest add wins)', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as any);
      await upsertListFavorite(listId, 'Latte fresco', 'beverages');
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect((patch as any).name).toBe('Latte fresco');
      expect((patch as any).category).toBe('beverages');
    });
  });

  describe('setListFavoriteExcluded', () => {
    it('writes excluded=true and forces pinned=false', async () => {
      await setListFavoriteExcluded(listId, 'latte', true);
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toEqual({ excluded: true, pinned: false });
    });

    it('writes excluded=false without touching pinned', async () => {
      await setListFavoriteExcluded(listId, 'latte', false);
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toEqual({ excluded: false });
    });
  });

  describe('setListFavoriteState', () => {
    it('marking as favorite sets pinned=true, dismissedFavorite=false, excluded=false', async () => {
      await setListFavoriteState(listId, 'latte', true);
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toEqual({
        pinned: true,
        dismissedFavorite: false,
        excluded: false,
      });
    });

    it('un-favoriting sets pinned=false, dismissedFavorite=true (does not exclude)', async () => {
      await setListFavoriteState(listId, 'latte', false);
      const [, patch] = vi.mocked(updateDoc).mock.calls[0];
      expect(patch).toEqual({ pinned: false, dismissedFavorite: true });
    });
  });

  describe('ensureListFavorite', () => {
    it('creates a new doc with usageCount=0 when missing (does NOT increment)', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      await ensureListFavorite(listId, 'Babà', 'bakery');
      expect(setDoc).toHaveBeenCalledOnce();
      const [, data] = vi.mocked(setDoc).mock.calls[0];
      expect(data).toMatchObject({
        slug: 'baba',
        name: 'Babà',
        category: 'bakery',
        usageCount: 0,
      });
    });

    it('no-op when doc already exists (preserves existing usageCount + flags)', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as any);
      await ensureListFavorite(listId, 'Latte', 'dairy');
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('returns the slug regardless of create/no-op branch', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as any);
      const slug = await ensureListFavorite(listId, 'Pane Integrale', 'bakery');
      expect(slug).toBe('pane integrale');
    });
  });

  describe('findListFavoriteByName', () => {
    it('returns null when doc missing', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);
      const out = await findListFavoriteByName(listId, 'Latte');
      expect(out).toBeNull();
    });

    it('returns hydrated entry when doc exists', async () => {
      const docData: Omit<ListFavoriteState, 'slug'> = {
        name: 'Latte',
        category: 'dairy',
        usageCount: 3,
        lastUsedAt: 1000,
        pinned: true,
      };
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => docData,
      } as any);
      const out = await findListFavoriteByName(listId, 'Latte');
      expect(out).toEqual({ slug: 'latte', ...docData });
    });
  });

  describe('subscribeListFavorites', () => {
    it('returns an unsubscribe function and calls onSnapshot once', () => {
      vi.mocked(onSnapshot).mockReturnValue(vi.fn() as any);
      const unsub = subscribeListFavorites(listId, vi.fn(), vi.fn());
      expect(typeof unsub).toBe('function');
      expect(onSnapshot).toHaveBeenCalledOnce();
    });

    it('maps snapshot docs into ListFavoriteState (slug from doc id)', () => {
      let capturedNext: ((snap: any) => void) | undefined;
      vi.mocked(onSnapshot).mockImplementation((_col, onNext: any) => {
        capturedNext = onNext;
        return vi.fn() as any;
      });

      const onChange = vi.fn();
      subscribeListFavorites(listId, onChange, vi.fn());

      capturedNext!({
        docs: [
          {
            id: 'latte',
            data: () => ({
              name: 'Latte',
              category: 'dairy',
              usageCount: 2,
              lastUsedAt: 1000,
              pinned: true,
            }),
          },
        ],
      });

      const entries = onChange.mock.calls[0][0];
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        slug: 'latte',
        name: 'Latte',
        pinned: true,
      });
    });

    it('surfaces snapshot errors via onError', () => {
      vi.mocked(onSnapshot).mockImplementation((_col, _onNext: any, onError: any) => {
        onError(new Error('permission-denied'));
        return vi.fn() as any;
      });
      const onError = vi.fn();
      subscribeListFavorites(listId, vi.fn(), onError);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
