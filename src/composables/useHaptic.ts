import { prefersReducedMotionSync } from './useReducedMotion';

const STORAGE_KEY = 'buy-the-way:haptic';
const DEFAULT_DURATION_MS = 10;

export const isHapticEnabled = (): boolean => {
  if (typeof localStorage === 'undefined') return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v !== 'false';
};

export const setHapticEnabled = (enabled: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
};

export const useHaptic = (): { pulse: (durationMs?: number) => void } => {
  const pulse = (durationMs: number = DEFAULT_DURATION_MS): void => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (prefersReducedMotionSync()) return;
    if (!isHapticEnabled()) return;
    try {
      navigator.vibrate(durationMs);
    } catch {
      // best-effort; some platforms throw on unsupported
    }
  };

  return { pulse };
};
