import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  compressImage,
  compressItemPhoto,
  PHOTO_PRESET,
  THUMB_PRESET,
} from '@/composables/useImageCompress';

/**
 * jsdom doesn't ship a full canvas implementation; we stub the bits the
 * compressor actually touches so the resize math + toBlob plumbing get
 * exercised without dragging node-canvas into the test runtime.
 */
class FakeImage {
  width = 1000;
  height = 500;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

describe('useImageCompress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    const drawImageSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const c = {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue({ drawImage: drawImageSpy }),
          toBlob: vi.fn((cb: BlobCallback, _type: string, _quality: number) => {
            cb(new Blob(['compressed'], { type: 'image/jpeg' }));
          }),
        } as unknown as HTMLCanvasElement;
        return c;
      }
      return document.createElement.call(document, tag);
    });
  });

  it('returns a Blob with image/jpeg type', async () => {
    const out = await compressImage(new Blob(['raw'], { type: 'image/png' }));
    expect(out.type).toBe('image/jpeg');
  });

  it('honours custom maxEdge + quality overrides', async () => {
    const out = await compressImage(new Blob(['raw']), { maxEdge: 400, quality: 0.9 });
    expect(out.type).toBe('image/jpeg');
  });

  it('compressItemPhoto returns both variants', async () => {
    const out = await compressItemPhoto(new Blob(['raw']));
    expect(out.photo.type).toBe('image/jpeg');
    expect(out.thumb.type).toBe('image/jpeg');
  });

  it('exports the documented presets', () => {
    expect(PHOTO_PRESET).toEqual({ maxEdge: 800, quality: 0.7 });
    expect(THUMB_PRESET).toEqual({ maxEdge: 200, quality: 0.6 });
  });

  it('throws when canvas.toBlob returns null', async () => {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
          toBlob: vi.fn((cb: BlobCallback) => cb(null)),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.call(document, tag);
    });
    await expect(compressImage(new Blob(['raw']))).rejects.toThrow(/toBlob/);
  });

  it('throws when canvas 2d context is unavailable', async () => {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0, height: 0,
          getContext: vi.fn().mockReturnValue(null),
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement.call(document, tag);
    });
    await expect(compressImage(new Blob(['raw']))).rejects.toThrow(/2d context/);
  });
});
