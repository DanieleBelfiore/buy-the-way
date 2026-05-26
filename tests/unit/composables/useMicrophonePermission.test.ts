import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureMicrophoneAccess,
  isStandaloneDisplayMode,
} from '@/composables/useMicrophonePermission';

describe('useMicrophonePermission', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ensureMicrophoneAccess returns granted when getUserMedia succeeds', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      configurable: true,
    });
    await expect(ensureMicrophoneAccess()).resolves.toBe('granted');
  });

  it('ensureMicrophoneAccess returns denied when getUserMedia throws NotAllowedError', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
      configurable: true,
    });
    await expect(ensureMicrophoneAccess()).resolves.toBe('denied');
  });

  it('ensureMicrophoneAccess returns denied when Permissions API reports denied', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue({ state: 'denied' }),
      },
      configurable: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    await expect(ensureMicrophoneAccess()).resolves.toBe('denied');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('isStandaloneDisplayMode is true for display-mode standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
      writable: true,
    });
    expect(isStandaloneDisplayMode()).toBe(true);
  });
});
