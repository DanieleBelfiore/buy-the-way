#!/usr/bin/env node
/**
 * Generate PWA icon set from public/branding/logo-original.png.
 * Outputs to public/icons/: icon-192.png, icon-512.png,
 * icon-maskable-512.png, apple-touch-icon.png, favicon.ico (32 px PNG).
 *
 * Usage: pnpm icons:generate
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../public/branding/logo-original.png');
const OUT = resolve(__dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

const BG = { r: 247, g: 244, b: 237, alpha: 1 };
const MASKABLE_PAD = 0.2;

async function generate() {
  // Standard icons — content fitted with cream background
  for (const px of [192, 512]) {
    await sharp(SRC)
      .resize(px, px, { fit: 'contain', background: BG })
      .png()
      .toFile(resolve(OUT, `icon-${px}.png`));
    console.log(`icon-${px}.png`);
  }

  // Maskable 512 — content at 60% centre, safe-zone padding
  const contentSize = Math.round(512 * (1 - MASKABLE_PAD * 2));
  const inner = await sharp(SRC)
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 247, g: 244, b: 237, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 247, g: 244, b: 237, alpha: 255 } } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(resolve(OUT, 'icon-maskable-512.png'));
  console.log('icon-maskable-512.png');

  // Apple touch icon 180 px
  await sharp(SRC)
    .resize(180, 180, { fit: 'contain', background: BG })
    .png()
    .toFile(resolve(OUT, 'apple-touch-icon.png'));
  console.log('apple-touch-icon.png');

  // Favicon — 32 px PNG (browsers accept PNG favicon via <link rel="icon">)
  await sharp(SRC)
    .resize(32, 32, { fit: 'contain', background: BG })
    .png()
    .toFile(resolve(OUT, 'favicon.ico'));
  console.log('favicon.ico');

  console.log(`\nAll icons written to ${OUT}`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
