import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

import { useThemeStore } from '@/stores/theme';

const STORAGE_KEY = 'btw:themeMode';

// Build a minimal MediaQueryList stub so we can drive 'change' events from tests.
type StubMQ = MediaQueryList & {
  __dispatch: (next: boolean) => void;
};

const installMatchMedia = (initialDark: boolean) => {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mq: Partial<StubMQ> = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (type: string, cb: any) => {
      if (type === 'change') listeners.add(cb);
    },
    removeEventListener: (type: string, cb: any) => {
      if (type === 'change') listeners.delete(cb);
    },
    __dispatch: (next: boolean) => {
      (mq as any).matches = next;
      listeners.forEach((cb) =>
        cb({ matches: next } as MediaQueryListEvent),
      );
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue(mq as MediaQueryList),
  );
  // Also stub on window for code that calls window.matchMedia.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue(mq as MediaQueryList),
  });
  return mq as StubMQ;
};

describe('useThemeStore', () => {
  let teardownInit: (() => void) | null = null;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    teardownInit?.();
    teardownInit = null;
    vi.unstubAllGlobals();
  });

  it('defaults to light mode when localStorage is empty', () => {
    installMatchMedia(false);
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.mode).toBe('light');
  });

  it('hydrates mode from localStorage', () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, 'dark');
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.mode).toBe('dark');
  });

  it('ignores garbage values in localStorage and falls back to light', () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, 'banana');
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.mode).toBe('light');
  });

  it('maps legacy "system" stored value to the new light default', () => {
    installMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, 'system');
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.mode).toBe('light');
    expect(store.resolved).toBe('light');
  });

  it('resolves to the explicit mode regardless of OS preference', () => {
    installMatchMedia(true); // OS prefers dark
    localStorage.setItem(STORAGE_KEY, 'light');
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.resolved).toBe('light');
  });

  it('applies data-theme attribute on init', () => {
    installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, 'dark');
    const store = useThemeStore();
    teardownInit = store.init();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(store).toBeTruthy();
  });

  it('setMode persists to localStorage and updates data-theme', () => {
    installMatchMedia(false);
    const store = useThemeStore();
    teardownInit = store.init();
    store.setMode('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does NOT flip when OS pref changes - user choice always wins', () => {
    const mq = installMatchMedia(false);
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.resolved).toBe('light');
    mq.__dispatch(true);
    expect(store.resolved).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('teardown removes the media-query listener', () => {
    const mq = installMatchMedia(false);
    const store = useThemeStore();
    teardownInit = store.init();
    teardownInit();
    teardownInit = null;
    // After teardown, an OS-level change should NOT trigger any listener.
    mq.__dispatch(true);
    expect(store.resolved).toBe('light');
  });

  describe('theme-color meta tag', () => {
    beforeEach(() => {
      // Clean up any leftover meta tags between tests.
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.remove());
    });

    it('writes a single unconditional theme-color meta on init', () => {
      installMatchMedia(false);
      const store = useThemeStore();
      teardownInit = store.init();
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      expect(metas).toHaveLength(1);
      expect(metas[0]?.getAttribute('media')).toBeNull();
      expect(metas[0]?.getAttribute('content')).toBe('#f7f4ed');
      expect(store).toBeTruthy();
    });

    it('uses the dark surface color when resolved is dark', () => {
      installMatchMedia(false);
      localStorage.setItem(STORAGE_KEY, 'dark');
      const store = useThemeStore();
      teardownInit = store.init();
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).toBe('#15151a');
      expect(store).toBeTruthy();
    });

    it('removes pre-existing media-scoped fallback metas', () => {
      const light = document.createElement('meta');
      light.setAttribute('name', 'theme-color');
      light.setAttribute('media', '(prefers-color-scheme: light)');
      light.setAttribute('content', '#fff');
      document.head.appendChild(light);
      const dark = document.createElement('meta');
      dark.setAttribute('name', 'theme-color');
      dark.setAttribute('media', '(prefers-color-scheme: dark)');
      dark.setAttribute('content', '#000');
      document.head.appendChild(dark);

      installMatchMedia(false);
      const store = useThemeStore();
      teardownInit = store.init();
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      expect(metas).toHaveLength(1);
      expect(metas[0]?.hasAttribute('media')).toBe(false);
      expect(store).toBeTruthy();
    });

    it('updates content when setMode flips the resolved theme', () => {
      installMatchMedia(false);
      const store = useThemeStore();
      teardownInit = store.init();
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.getAttribute('content'),
      ).toBe('#f7f4ed');
      store.setMode('dark');
      expect(
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.getAttribute('content'),
      ).toBe('#15151a');
    });
  });

  it('survives matchMedia being unavailable (SSR-ish env)', () => {
    // Strip both top-level and window.matchMedia.
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
    const store = useThemeStore();
    teardownInit = store.init();
    expect(store.mode).toBe('light');
    expect(store.resolved).toBe('light');
  });
});
