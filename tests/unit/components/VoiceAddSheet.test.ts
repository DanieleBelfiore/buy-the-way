import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import VoiceAddSheet from '@/components/list/VoiceAddSheet.vue';
import type { Category } from '@/domain/types';

const messages = {
  en: {
    list: { cancel: 'Cancel' },
    item: {
      voiceAdd: 'Add by voice',
      voiceTitle: 'Add by voice',
      voiceHint: 'Tap the mic.',
      voiceStart: 'Start listening',
      voiceStop: 'Stop listening',
      voiceListening: 'Listening…',
      voicePermissionDenied: 'Mic denied',
      voiceNoSpeech: 'Didn\'t catch that.',
      voiceUnsupported: 'Not supported.',
      voiceError: 'Voice error.',
      bulkPasteCount: 'no items | Add 1 item | Add {n} items',
    },
  },
};

const buildI18n = () =>
  createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages });

const mountSheet = (overrides?: {
  open?: boolean;
  inferCategory?: (n: string) => Category;
}) =>
  mount(VoiceAddSheet, {
    props: {
      open: overrides?.open ?? true,
      inferCategory: overrides?.inferCategory ?? (() => 'other' as Category),
    },
    global: { plugins: [buildI18n()] },
  });

interface FakeRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
}
let lastRec: FakeRec | null = null;

describe('VoiceAddSheet', () => {
  beforeEach(() => {
    lastRec = null;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      configurable: true,
    });
    (window as unknown as Record<string, unknown>).SpeechRecognition = class {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 0;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      onresult: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      onend: (() => void) | null = null;
      constructor() {
        lastRec = this as unknown as FakeRec;
      }
    };
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'back').mockImplementation(() => {});
    history.replaceState(null, '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when open=false', () => {
    const wrapper = mountSheet({ open: false });
    expect(wrapper.find('[data-testid="voice-mic"]').exists()).toBe(false);
  });

  it('shows the unsupported notice when SpeechRecognition is absent', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    const wrapper = mountSheet();
    expect(wrapper.find('[data-testid="voice-unsupported"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="voice-mic"]').exists()).toBe(false);
  });

  it('shows the mic when the API is available', () => {
    const wrapper = mountSheet();
    expect(wrapper.find('[data-testid="voice-mic"]').exists()).toBe(true);
  });

  it('clicking the mic starts recognition', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    expect(lastRec).not.toBeNull();
    expect(lastRec!.start).toHaveBeenCalledOnce();
  });

  it('shows permission error without starting recognition when mic access is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      },
      configurable: true,
    });
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    expect(lastRec).toBeNull();
    expect(wrapper.find('[data-testid="voice-error"]').text()).toContain('Mic denied');
  });

  it('splits the transcript into preview rows once recognition emits results', async () => {
    const wrapper = mountSheet({ inferCategory: () => 'other' });
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    lastRec!.onresult!({
      resultIndex: 0,
      results: [[{ transcript: 'milk, bread and eggs' }]],
    });
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="voice-row"]');
    expect(rows).toHaveLength(3);
  });

  it('submit emits the inferred-category rows', async () => {
    const wrapper = mountSheet({
      inferCategory: (name) => (name === 'milk' ? 'dairy' : 'other'),
    });
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    lastRec!.onresult!({
      resultIndex: 0,
      results: [[{ transcript: 'milk and bread' }]],
    });
    // Recognition end before submit to satisfy `canSubmit`.
    lastRec!.onend!();
    await flushPromises();
    await wrapper.find('[data-testid="voice-submit"]').trigger('click');
    expect(wrapper.emitted('submit')).toBeTruthy();
    const payload = wrapper.emitted('submit')![0]![0] as Array<{ name: string; category: Category }>;
    expect(payload).toEqual([
      { name: 'milk', category: 'dairy' },
      { name: 'bread', category: 'other' },
    ]);
  });

  it('cancel button emits cancel', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="voice-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('renders the listening indicator while recognition is running', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="voice-listening"]').exists()).toBe(true);
  });

  it('exposes a translated error when the recogniser reports not-allowed', async () => {
    const wrapper = mountSheet();
    await wrapper.find('[data-testid="voice-mic"]').trigger('click');
    await flushPromises();
    lastRec!.onerror!({ error: 'not-allowed' });
    await flushPromises();
    expect(wrapper.find('[data-testid="voice-error"]').text()).toContain('Mic denied');
  });
});
