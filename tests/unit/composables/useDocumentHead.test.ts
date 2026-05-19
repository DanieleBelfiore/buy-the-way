import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

const useHeadMock = vi.fn();
vi.mock('@unhead/vue', () => ({
  useHead: (...args: unknown[]) => useHeadMock(...args),
}));

import { useDocumentHead } from '@/composables/useDocumentHead';

const buildI18n = (locale: 'it' | 'en' = 'it') =>
  createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'it',
    messages: {
      it: {
        seo: {
          about: {
            title: 'Buy The Way — Liste della spesa condivise',
            description: 'Liste della spesa condivise in tempo reale.',
          },
        },
      },
      en: {
        seo: {
          about: {
            title: 'Buy The Way — Shared shopping lists',
            description: 'Shared shopping lists in real time.',
          },
        },
      },
    },
  });

const mountWithComposable = (options: Parameters<typeof useDocumentHead>[0], i18n = buildI18n()) => {
  const Comp = defineComponent({
    setup() {
      useDocumentHead(options);
      return () => h('div');
    },
  });
  return mount(Comp, { global: { plugins: [i18n] } });
};

describe('useDocumentHead', () => {
  beforeEach(() => {
    useHeadMock.mockClear();
  });

  it('calls useHead with reactive title from i18n', () => {
    mountWithComposable({ titleKey: 'seo.about.title', descriptionKey: 'seo.about.description' });
    expect(useHeadMock).toHaveBeenCalledTimes(1);
    const arg = useHeadMock.mock.calls[0]![0] as {
      title: () => string;
      meta: Array<{ name?: string; property?: string; content: () => string }>;
      htmlAttrs: { lang: () => string };
    };
    expect(arg.title()).toBe('Buy The Way — Liste della spesa condivise');
    expect(arg.htmlAttrs.lang()).toBe('it');
    const desc = arg.meta.find((m) => m.name === 'description');
    expect(desc?.content()).toBe('Liste della spesa condivise in tempo reale.');
  });

  it('updates title and lang when locale changes', async () => {
    const i18n = buildI18n('it');
    mountWithComposable(
      { titleKey: 'seo.about.title', descriptionKey: 'seo.about.description' },
      i18n,
    );
    const arg = useHeadMock.mock.calls[0]![0] as {
      title: () => string;
      htmlAttrs: { lang: () => string };
    };
    expect(arg.title()).toBe('Buy The Way — Liste della spesa condivise');
    (i18n.global.locale as { value: string }).value = 'en';
    await nextTick();
    expect(arg.title()).toBe('Buy The Way — Shared shopping lists');
    expect(arg.htmlAttrs.lang()).toBe('en');
  });

  it('emits og:title and og:description meta entries', () => {
    mountWithComposable({ titleKey: 'seo.about.title', descriptionKey: 'seo.about.description' });
    const arg = useHeadMock.mock.calls[0]![0] as {
      meta: Array<{ name?: string; property?: string; content: () => string }>;
    };
    const ogTitle = arg.meta.find((m) => m.property === 'og:title');
    const ogDesc = arg.meta.find((m) => m.property === 'og:description');
    const twTitle = arg.meta.find((m) => m.name === 'twitter:title');
    expect(ogTitle?.content()).toBe('Buy The Way — Liste della spesa condivise');
    expect(ogDesc?.content()).toBe('Liste della spesa condivise in tempo reale.');
    expect(twTitle?.content()).toBe('Buy The Way — Liste della spesa condivise');
  });

  it('uses ogImage override when provided', () => {
    mountWithComposable({
      titleKey: 'seo.about.title',
      descriptionKey: 'seo.about.description',
      ogImage: '/branding/og-image.png',
    });
    const arg = useHeadMock.mock.calls[0]![0] as {
      meta: Array<{ name?: string; property?: string; content: string | (() => string) }>;
    };
    const ogImg = arg.meta.find((m) => m.property === 'og:image');
    expect(ogImg?.content).toBe('/branding/og-image.png');
  });
});
