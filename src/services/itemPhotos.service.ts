import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, storage } from '@/services/firebase';
import { compressItemPhoto } from '@/composables/useImageCompress';
import { notifyListEvent } from '@/services/notify.service';
import type { ULID } from '@/domain/id';

/**
 * S4.2: upload + delete helpers for per-item photos.
 *
 * Storage layout:
 *   lists/{listId}/items/{itemId}/photo.jpg  (max 800px, q=0.7)
 *   lists/{listId}/items/{itemId}/thumb.jpg  (max 200px, q=0.6)
 *
 * After upload we persist the download URLs on the item doc so other
 * collaborators see them in their realtime snapshot without a fresh
 * Storage round-trip.
 */

const photoPath = (listId: ULID, itemId: ULID): string =>
  `lists/${listId}/items/${itemId}/photo.jpg`;
const thumbPath = (listId: ULID, itemId: ULID): string =>
  `lists/${listId}/items/${itemId}/thumb.jpg`;

export interface UploadResult {
  photoURL: string;
  thumbURL: string;
}

/**
 * Compress a user-picked file into photo + thumb variants, upload both,
 * patch the parent item doc with the new download URLs.
 */
export const uploadItemPhoto = async (
  listId: ULID,
  itemId: ULID,
  file: Blob,
): Promise<UploadResult> => {
  const { photo, thumb } = await compressItemPhoto(file);

  const photoRef = storageRef(storage, photoPath(listId, itemId));
  const thumbRef = storageRef(storage, thumbPath(listId, itemId));

  await Promise.all([
    uploadBytes(photoRef, photo, { contentType: 'image/jpeg' }),
    uploadBytes(thumbRef, thumb, { contentType: 'image/jpeg' }),
  ]);
  const [photoURL, thumbURL] = await Promise.all([
    getDownloadURL(photoRef),
    getDownloadURL(thumbRef),
  ]);

  await updateDoc(doc(db, 'lists', listId, 'items', itemId), {
    photoURL,
    thumbURL,
    updatedAt: Date.now(),
  });

  void notifyListEvent({
    listId,
    kind: 'item-modified',
    itemId,
  });

  return { photoURL, thumbURL };
};

/**
 * Best-effort cleanup: clear the item's photoURL/thumbURL fields + delete
 * both Storage objects. Each Storage delete is independent so a partial
 * failure (e.g. thumb missing) doesn't block the patch.
 */
export const removeItemPhoto = async (
  listId: ULID,
  itemId: ULID,
): Promise<void> => {
  // The patch may fail if the parent item doc has already been deleted by
  // a concurrent cascade (e.g. deleteList running). That's not fatal: we
  // still want the Storage objects gone, so swallow the error and continue.
  await updateDoc(doc(db, 'lists', listId, 'items', itemId), {
    photoURL: deleteField(),
    thumbURL: deleteField(),
    updatedAt: Date.now(),
  }).catch((err) => {
    console.warn('[itemPhotos] updateDoc patch failed (continuing to Storage purge):', err);
  });

  void notifyListEvent({
    listId,
    kind: 'item-modified',
    itemId,
  });

  await purgeItemPhotoStorage(listId, itemId);
};

/**
 * I1 cascade helper: delete the Storage objects only. Used by
 * `deleteList` where the item doc is about to be removed anyway and the
 * doc patch would be wasted work.
 */
export const purgeItemPhotoStorage = async (
  listId: ULID,
  itemId: ULID,
): Promise<void> => {
  const photoRef = storageRef(storage, photoPath(listId, itemId));
  const thumbRef = storageRef(storage, thumbPath(listId, itemId));
  await Promise.all([
    deleteObject(photoRef).catch((err) => {
      console.warn('[itemPhotos] delete photo failed:', err);
    }),
    deleteObject(thumbRef).catch((err) => {
      console.warn('[itemPhotos] delete thumb failed:', err);
    }),
  ]);
};
