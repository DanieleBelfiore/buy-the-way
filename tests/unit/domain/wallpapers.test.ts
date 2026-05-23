import { describe, it, expect } from 'vitest';
import {
  WALLPAPERS,
  isWallpaper,
  pickRandomWallpaper,
  wallpaperUrl,
} from '@/domain/wallpapers';

describe('WALLPAPERS', () => {
  it('contains exactly 8 entries 01.jpg–08.jpg', () => {
    expect(WALLPAPERS).toHaveLength(8);
    expect([...WALLPAPERS]).toEqual([
      '01.jpg',
      '02.jpg',
      '03.jpg',
      '04.jpg',
      '05.jpg',
      '06.jpg',
      '07.jpg',
      '08.jpg',
    ]);
  });
});

describe('isWallpaper', () => {
  it('accepts allowlisted filenames', () => {
    expect(isWallpaper('01.jpg')).toBe(true);
    expect(isWallpaper('08.jpg')).toBe(true);
  });

  it('rejects unknown filenames', () => {
    expect(isWallpaper('09.jpg')).toBe(false);
    expect(isWallpaper('10.jpg')).toBe(false);
    expect(isWallpaper('11.jpg')).toBe(false);
    expect(isWallpaper('01.png')).toBe(false);
    expect(isWallpaper('')).toBe(false);
    expect(isWallpaper('../etc/passwd')).toBe(false);
    expect(isWallpaper('/wallpapers/01.jpg')).toBe(false);
  });
});

describe('pickRandomWallpaper', () => {
  it('returns an allowlisted wallpaper', () => {
    const w = pickRandomWallpaper();
    expect(isWallpaper(w)).toBe(true);
  });

  it('uses provided RNG deterministically', () => {
    const w1 = pickRandomWallpaper(() => 0);
    const w2 = pickRandomWallpaper(() => 0.5);
    const w3 = pickRandomWallpaper(() => 0.9999);
    expect(w1).toBe('01.jpg');
    expect(w2).toBe('05.jpg'); // 0.5 * 8 = 4 => index 4 => 05.jpg
    expect(w3).toBe('08.jpg');
  });

  it('returns a defined wallpaper for the max in-range rng value', () => {
    // Math.random() ∈ [0, 1); the relevant boundary is 0.9999...
    const w = pickRandomWallpaper(() => 0.99999);
    expect(w).toBe('08.jpg');
  });
});

describe('wallpaperUrl', () => {
  it('prefixes filename with /wallpapers/', () => {
    expect(wallpaperUrl('05.jpg')).toBe('/wallpapers/05.jpg');
  });
});
