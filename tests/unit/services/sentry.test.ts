import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from 'vue';

const initMock = vi.fn();
const browserTracingMock = vi.fn(() => ({ id: 'tracing' }));
const replayMock = vi.fn(() => ({ id: 'replay' }));

vi.mock('@sentry/vue', () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: (...args: unknown[]) => browserTracingMock(...args),
  replayIntegration: (...args: unknown[]) => replayMock(...args),
}));

import { initSentry, shouldFilterEvent } from '@/services/sentry';

describe('shouldFilterEvent', () => {
  it('returns false for null/undefined input', () => {
    expect(shouldFilterEvent(null)).toBe(false);
    expect(shouldFilterEvent(undefined)).toBe(false);
  });

  it('filters Firebase Auth popup-closed events', () => {
    expect(
      shouldFilterEvent({
        exception: { values: [{ value: 'Firebase: Error (auth/popup-closed-by-user).' }] },
      }),
    ).toBe(true);
  });

  it('filters Firestore unavailable / offline errors', () => {
    expect(
      shouldFilterEvent({ exception: { values: [{ type: 'FirestoreError', value: 'unavailable' }] } }),
    ).toBe(true);
  });

  it('filters NetworkError / Failed to fetch', () => {
    expect(
      shouldFilterEvent({ exception: { values: [{ type: 'TypeError', value: 'Failed to fetch' }] } }),
    ).toBe(true);
  });

  it('does NOT filter unrelated errors', () => {
    expect(
      shouldFilterEvent({ exception: { values: [{ type: 'TypeError', value: 'x.y is not a function' }] } }),
    ).toBe(false);
  });
});

describe('initSentry', () => {
  beforeEach(() => {
    initMock.mockClear();
    browserTracingMock.mockClear();
    replayMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no-ops in test env (PROD=false)', async () => {
    const app = createApp({});
    const result = await initSentry(app);
    expect(result).toBe(false);
    expect(initMock).not.toHaveBeenCalled();
  });

  it('no-ops when DSN missing even with PROD=true', async () => {
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const app = createApp({});
    const result = await initSentry(app);
    expect(result).toBe(false);
    expect(initMock).not.toHaveBeenCalled();
  });

  it('calls Sentry.init when PROD=true and DSN present', async () => {
    vi.stubEnv('PROD', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example@o0.ingest.sentry.io/1');
    vi.stubEnv('VITE_RELEASE', 'abc1234');
    const app = createApp({});
    const result = await initSentry(app);
    expect(result).toBe(true);
    expect(initMock).toHaveBeenCalledTimes(1);
    const config = initMock.mock.calls[0]![0] as {
      dsn: string;
      release: string;
      environment: string;
      tracesSampleRate: number;
      replaysOnErrorSampleRate: number;
      replaysSessionSampleRate: number;
      beforeSend: (e: unknown) => unknown;
    };
    expect(config.dsn).toBe('https://example@o0.ingest.sentry.io/1');
    expect(config.release).toBe('abc1234');
    expect(config.environment).toBe('production');
    expect(config.tracesSampleRate).toBe(0.1);
    expect(config.replaysOnErrorSampleRate).toBe(1.0);
    expect(config.replaysSessionSampleRate).toBe(0);
    expect(replayMock).toHaveBeenCalledWith(
      expect.objectContaining({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    );
    const filteredEvent = config.beforeSend({
      exception: { values: [{ value: 'auth/popup-closed-by-user' }] },
    });
    expect(filteredEvent).toBeNull();
    const passEvent = config.beforeSend({
      exception: { values: [{ value: 'real bug' }] },
    });
    expect(passEvent).not.toBeNull();
  });
});
