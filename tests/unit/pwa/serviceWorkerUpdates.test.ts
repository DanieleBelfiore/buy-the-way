import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SW_UPDATE_POLL_INTERVAL_MS,
  attachServiceWorkerUpdateChecks,
  detachServiceWorkerUpdateChecks,
} from '@/pwa/serviceWorkerUpdates';

describe('serviceWorkerUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    detachServiceWorkerUpdateChecks();
  });

  afterEach(() => {
    detachServiceWorkerUpdateChecks();
    vi.useRealTimers();
  });

  it('uses a one-hour poll interval', () => {
    expect(SW_UPDATE_POLL_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it('checks for updates immediately and again after one hour', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = { update } as unknown as ServiceWorkerRegistration;

    attachServiceWorkerUpdateChecks(registration);
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SW_UPDATE_POLL_INTERVAL_MS - 1);
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('checks for updates when the tab becomes visible', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = { update } as unknown as ServiceWorkerRegistration;

    attachServiceWorkerUpdateChecks(registration);
    update.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('stops polling when detached', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = { update } as unknown as ServiceWorkerRegistration;

    attachServiceWorkerUpdateChecks(registration);
    detachServiceWorkerUpdateChecks();

    vi.advanceTimersByTime(SW_UPDATE_POLL_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
