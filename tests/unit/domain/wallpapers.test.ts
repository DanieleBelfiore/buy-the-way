import { describe, it, expect } from 'vitest';
import {
  WALLPAPERS,
  isWallpaper,
  pickRandomWallpaper,
  wallpaperUrl,
} from '@/domain/wallpapers';

describe('WALLPAPERS', () => {
  it('contains exactly 10 entries 01.jpg–10.jpg', () => {
    expect(WALLPAPERS).toHaveLength(10);
    expect([...WALLPAPERS]).toEqual([
      '01.jpg',
      '02.jpg',
      '03.jpg',
      '04.jpg',
      '05.jpg',
      '06.jpg',
      '07.jpg',
      '08.jpg',
      '09.jpg',
      '10.jpg',
    ]);
  });
});

describe('isWallpaper', () => {
  it('accepts allowlisted filenames', () => {
    expect(isWallpaper('01.jpg')).toBe(true);
    expect(isWallpaper('10.jpg')).toBe(true);
  });

  it('rejects unknown filenames', () => {
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
    expect(w2).toBe('06.jpg');
    expect(w3).toBe('10.jpg');
  });

  it('clamps the index when rng returns 1', () => {
    const w = pickRandomWallpaper(() => 1);
    expect(w).toBe('10.jpg');
  });
});

describe('wallpaperUrl', () => {
  it('prefixes filename with /wallpapers/', () => {
    expect(wallpaperUrl('05.jpg')).toBe('/wallpapers/05.jpg');
  });
});
