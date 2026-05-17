import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHaptic, isHapticEnabled, setHapticEnabled } from '@/composables/useHaptic';

describe('useHaptic', () => {
  const originalVibrate = navigator.vibrate;
  let vibrateMock: ReturnType<typeof vi.fn>;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as any;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      configurable: true,
      writable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  it('calls navigator.vibrate with 10ms by default', () => {
    const { pulse } = useHaptic();
    pulse();
    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it('respects custom duration', () => {
    const { pulse } = useHaptic();
    pulse(25);
    expect(vibrateMock).toHaveBeenCalledWith(25);
  });

  it('does not vibrate when disabled via localStorage', () => {
    setHapticEnabled(false);
    const { pulse } = useHaptic();
    pulse();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('does not vibrate when prefers-reduced-motion is set', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as any;
    const { pulse } = useHaptic();
    pulse();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('isHapticEnabled defaults to true', () => {
    expect(isHapticEnabled()).toBe(true);
  });

  it('isHapticEnabled returns false after setHapticEnabled(false)', () => {
    setHapticEnabled(false);
    expect(isHapticEnabled()).toBe(false);
  });

  it('does not throw when navigator.vibrate is unavailable', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
    const { pulse } = useHaptic();
    expect(() => pulse()).not.toThrow();
  });
});
