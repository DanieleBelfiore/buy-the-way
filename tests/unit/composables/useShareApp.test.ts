import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createI18n } from 'vue-i18n';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';

import { useShareApp } from '@/composables/useShareApp';

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      settings: { shareMessage: 'Try BTW.' },
    },
  },
});

/**
 * Mount a throwaway component so we get a proper Vue setup context for
 * useI18n() — otherwise the composable fails outside a component instance.
 */
const callShare = async (override?: string) => {
  let api!: ReturnType<typeof useShareApp>;
  const Comp = defineComponent({
    setup() {
      api = useShareApp();
      return () => null;
    },
  });
  mount(Comp, { global: { plugins: [i18n] } });
  return api.shareApp(override);
};

describe('useShareApp', () => {
  const originalShare = (window.navigator as any).share;
  const originalClipboard = (window.navigator as any).clipboard;

  afterEach(() => {
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: originalShare,
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls navigator.share when available and reports ok=true / copied=false', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: share });

    const res = await callShare();
    expect(share).toHaveBeenCalledOnce();
    expect(res).toEqual({ ok: true, copied: false });
  });

  it('returns ok=false / copied=false when user cancels (AbortError)', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('cancel', 'AbortError'));
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: share });
    const writeText = vi.fn();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const res = await callShare();
    expect(writeText).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, copied: false });
  });

  it('falls back to clipboard when navigator.share missing', async () => {
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const res = await callShare();
    expect(writeText).toHaveBeenCalledOnce();
    expect(res).toEqual({ ok: true, copied: true });
  });

  it('honours overrideMessage', async () => {
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await callShare('Custom message');
    const arg = writeText.mock.calls[0]?.[0];
    expect(arg).toContain('Custom message');
  });

  it('returns ok=false when clipboard fails', async () => {
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const res = await callShare();
    expect(res).toEqual({ ok: false, copied: false });
  });
});
