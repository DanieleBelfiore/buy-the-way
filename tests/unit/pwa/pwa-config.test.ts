import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ICONS_DIR = resolve(process.cwd(), 'public/icons');
const VITE_CONFIG = resolve(process.cwd(), 'vite.config.ts');

describe('PWA icons', () => {
  it('icon-192.png exists', () => {
    expect(existsSync(resolve(ICONS_DIR, 'icon-192.png'))).toBe(true);
  });

  it('icon-512.png exists', () => {
    expect(existsSync(resolve(ICONS_DIR, 'icon-512.png'))).toBe(true);
  });

  it('icon-maskable-512.png exists', () => {
    expect(existsSync(resolve(ICONS_DIR, 'icon-maskable-512.png'))).toBe(true);
  });

  it('apple-touch-icon.png exists', () => {
    expect(existsSync(resolve(ICONS_DIR, 'apple-touch-icon.png'))).toBe(true);
  });

  it('favicon.ico exists', () => {
    expect(existsSync(resolve(ICONS_DIR, 'favicon.ico'))).toBe(true);
  });
});

describe('PWA vite config', () => {
  it('imports VitePWA', () => {
    const src = readFileSync(VITE_CONFIG, 'utf8');
    expect(src).toContain("from 'vite-plugin-pwa'");
    expect(src).toContain('VitePWA(');
  });

  it('manifest has correct theme_color and background_color', () => {
    const src = readFileSync(VITE_CONFIG, 'utf8');
    expect(src).toContain("theme_color: '#1c1c1c'");
    expect(src).toContain("background_color: '#f7f4ed'");
  });

  it('manifest includes maskable icon purpose', () => {
    const src = readFileSync(VITE_CONFIG, 'utf8');
    expect(src).toContain("purpose: 'maskable'");
  });

  it('icons:generate script exists in package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['icons:generate']).toBeDefined();
  });
});
