export const WALLPAPERS = [
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
] as const;

export type Wallpaper = (typeof WALLPAPERS)[number];

const WALLPAPER_SET = new Set<string>(WALLPAPERS);

export const isWallpaper = (value: string): value is Wallpaper =>
  WALLPAPER_SET.has(value);

export const pickRandomWallpaper = (
  rng: () => number = Math.random,
): Wallpaper => {
  const idx = Math.floor(rng() * WALLPAPERS.length);
  const safe = Math.min(idx, WALLPAPERS.length - 1);
  return WALLPAPERS[safe]!;
};

export const wallpaperUrl = (filename: string): string =>
  `/wallpapers/${filename}`;
