import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadBytesMock = vi.fn().mockResolvedValue(undefined);
const getDownloadURLMock = vi.fn();
const deleteObjectMock = vi.fn().mockResolvedValue(undefined);
const updateDocMock = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path: string) => ({ __path: path })),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts: string[]) => ({ __path: parts.join('/') })),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteField: vi.fn().mockReturnValue({ __op: 'delete' }),
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: 'db' },
  storage: { __mock: 'storage' },
}));

vi.mock('@/composables/useImageCompress', () => ({
  compressItemPhoto: vi.fn().mockResolvedValue({
    photo: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
    thumb: new Blob(['thumb-bytes'], { type: 'image/jpeg' }),
  }),
}));

import { uploadItemPhoto, removeItemPhoto } from '@/services/itemPhotos.service';
import type { ULID } from '@/domain/id';

const LIST = '01LIST' as ULID;
const ITEM = '01ITEM' as ULID;

describe('itemPhotos.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadItemPhoto', () => {
    it('compresses, uploads photo + thumb, then patches the item doc with both URLs', async () => {
      getDownloadURLMock
        .mockResolvedValueOnce('https://storage/photo.jpg')
        .mockResolvedValueOnce('https://storage/thumb.jpg');

      const file = new Blob(['raw-bytes'], { type: 'image/png' });
      const out = await uploadItemPhoto(LIST, ITEM, file);

      expect(uploadBytesMock).toHaveBeenCalledTimes(2);
      expect(out).toEqual({
        photoURL: 'https://storage/photo.jpg',
        thumbURL: 'https://storage/thumb.jpg',
      });
      expect(updateDocMock).toHaveBeenCalledOnce();
      const [, payload] = updateDocMock.mock.calls[0]!;
      expect((payload as any).photoURL).toBe('https://storage/photo.jpg');
      expect((payload as any).thumbURL).toBe('https://storage/thumb.jpg');
      expect(typeof (payload as any).updatedAt).toBe('number');
    });
  });

  describe('removeItemPhoto', () => {
    it('clears the item doc fields with deleteField markers, then deletes both storage objects', async () => {
      await removeItemPhoto(LIST, ITEM);
      expect(updateDocMock).toHaveBeenCalledOnce();
      const [, payload] = updateDocMock.mock.calls[0]!;
      expect((payload as any).photoURL).toEqual({ __op: 'delete' });
      expect((payload as any).thumbURL).toEqual({ __op: 'delete' });
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    });

    it('swallows individual delete failures so a missing thumb does not block the rest', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      deleteObjectMock
        .mockRejectedValueOnce(new Error('photo missing'))
        .mockResolvedValueOnce(undefined);
      await expect(removeItemPhoto(LIST, ITEM)).resolves.toBeUndefined();
      warn.mockRestore();
    });
  });
});
