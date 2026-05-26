/**
 * S4.2: client-side image compression via `<canvas>`. Keeps Firebase Storage
 * usage well within the 5GB Spark cap by enforcing a max long-edge + JPEG
 * quality before upload.
 *
 * Pure module-level helpers (no Vue component instance needed) so they can
 * be invoked from a service.
 */

export interface CompressOptions {
  /** Longest edge after resize. Aspect ratio is preserved. */
  maxEdge: number;
  /** JPEG quality 0..1. */
  quality: number;
}

const DEFAULT_PHOTO: CompressOptions = { maxEdge: 800, quality: 0.7 };
const DEFAULT_THUMB: CompressOptions = { maxEdge: 200, quality: 0.6 };

/**
 * Load a File/Blob into an HTMLImageElement so we can draw it onto a canvas.
 */
const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err instanceof Error ? err : new Error('image load failed'));
    };
    img.src = url;
  });

/**
 * Compress `file` into a JPEG Blob no larger than `maxEdge` on the longest
 * side. Returns the resulting Blob. Throws if the source can't be decoded.
 */
export const compressImage = async (
  file: Blob,
  opts: Partial<CompressOptions> = {},
): Promise<Blob> => {
  const merged = { ...DEFAULT_PHOTO, ...opts };
  const img = await loadImage(file);
  const scale = Math.min(1, merged.maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', merged.quality);
  });
  if (!blob) throw new Error('canvas toBlob returned null');
  return blob;
};

/** Convenience: produce both photo + thumbnail variants in one call. */
export const compressItemPhoto = async (
  file: Blob,
): Promise<{ photo: Blob; thumb: Blob }> => {
  const photo = await compressImage(file, DEFAULT_PHOTO);
  const thumb = await compressImage(file, DEFAULT_THUMB);
  return { photo, thumb };
};

export const PHOTO_PRESET = DEFAULT_PHOTO;
export const THUMB_PRESET = DEFAULT_THUMB;
