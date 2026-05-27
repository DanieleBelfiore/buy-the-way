import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type ThemeMode = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'btw:themeMode';
const VALID_MODES: readonly ThemeMode[] = ['light', 'dark'] as const;

const isThemeMode = (v: unknown): v is ThemeMode =>
  typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v);

const readStoredMode = (): ThemeMode => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Legacy 'system' value (or any junk) maps back to the default 'light'.
    return isThemeMode(raw) ? raw : 'light';
  } catch {
    // Storage unavailable (Safari private mode, etc.) - fall back to default.
    return 'light';
  }
};

const systemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light');
  // Kept for back-compat with the meta-tag tests and any future re-enable of
  // the system option; not used by `resolved` while mode is explicit-only.
  const systemDark = ref(false);

  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  // With the system option removed, the resolved theme is always the explicit
  // user choice. The systemDark ref is still tracked so we can re-enable the
  // 'system' option later without touching every consumer.
  const resolved = computed<ResolvedTheme>(() => mode.value);

  // Surface colors used by mobile browsers / PWA chrome for the URL bar.
  // Must stay in sync with the surface tokens (`--cream`) in tokens.css.
  const THEME_COLORS: Record<ResolvedTheme, string> = {
    light: '#f7f4ed',
    dark: '#15151a',
  };

  const upsertMeta = (name: string, content: string): void => {
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  const updateChromeMetas = (next: ResolvedTheme): void => {
    if (typeof document === 'undefined') return;
    // Drop legacy OS-scoped theme-color tags; they invert Android PWA nav bar
    // when the phone is in dark mode but the app is in light mode.
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      if (m.hasAttribute('media')) m.remove();
    });
    upsertMeta('theme-color', THEME_COLORS[next]);
    upsertMeta('color-scheme', next);
  };

  const applyToDocument = (): void => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolved.value);
    updateChromeMetas(resolved.value);
  };

  const setMode = (next: ThemeMode): void => {
    mode.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage write failed - keep in-memory value, accept loss on reload.
    }
    applyToDocument();
  };

  /**
   * Hydrate the store from localStorage and wire the system-preference listener.
   * Safe to call once at app boot. Returns a teardown for the listener so tests
   * (or future cleanup) can detach cleanly.
   */
  const init = (): (() => void) => {
    mode.value = readStoredMode();
    systemDark.value = systemPrefersDark();
    applyToDocument();

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = (e: MediaQueryListEvent) => {
      // Track the OS preference so a future 'system' mode can pick it up, but
      // never re-apply: the user's explicit choice always wins.
      systemDark.value = e.matches;
    };
    // addEventListener is the modern API; addListener kept as fallback for
    // older Safari/iOS versions that may still ship without the EventTarget API.
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaListener);
    } else {
      // @ts-expect-error legacy MediaQueryList.addListener
      mediaQuery.addListener(mediaListener);
    }

    return () => {
      if (!mediaQuery || !mediaListener) return;
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', mediaListener);
      } else {
        // @ts-expect-error legacy MediaQueryList.removeListener
        mediaQuery.removeListener(mediaListener);
      }
      mediaQuery = null;
      mediaListener = null;
    };
  };

  return { mode, resolved, systemDark, init, setMode };
});
