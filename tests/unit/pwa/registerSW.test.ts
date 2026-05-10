import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

describe('registerSW module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports an initPWA function', async () => {
    const mod = await import('@/pwa/registerSW');
    expect(typeof mod.initPWA).toBe('function');
  });

  it('calls registerSW from vite-plugin-pwa', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const { initPWA } = await import('@/pwa/registerSW');
    initPWA();
    expect(registerSW).toHaveBeenCalledOnce();
  });

  it('passes onNeedRefresh callback', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const { initPWA } = await import('@/pwa/registerSW');
    initPWA();
    const calls = (registerSW as ReturnType<typeof vi.fn>).mock.calls;
    const arg = calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(typeof arg?.onNeedRefresh).toBe('function');
  });

  it('passes onOfflineReady callback', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const { initPWA } = await import('@/pwa/registerSW');
    initPWA();
    const calls = (registerSW as ReturnType<typeof vi.fn>).mock.calls;
    const arg = calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(typeof arg?.onOfflineReady).toBe('function');
  });
});
