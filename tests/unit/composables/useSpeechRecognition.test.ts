import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import {
  useSpeechRecognition,
  splitTranscriptIntoItems,
} from '@/composables/useSpeechRecognition';

const host = (capture: { api?: ReturnType<typeof useSpeechRecognition> } = {}) =>
  defineComponent({
    setup() {
      capture.api = useSpeechRecognition();
      return () => h('div');
    },
  });

interface FakeRecogniser {
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

describe('splitTranscriptIntoItems', () => {
  it('splits English "and" + commas', () => {
    expect(splitTranscriptIntoItems('milk, bread and eggs', 'en'))
      .toEqual(['milk', 'bread', 'eggs']);
  });

  it('splits Italian "e" + commas', () => {
    expect(splitTranscriptIntoItems('latte, pane e uova', 'it'))
      .toEqual(['latte', 'pane', 'uova']);
  });

  it('drops empty tokens from messy punctuation', () => {
    expect(splitTranscriptIntoItems('milk,, , bread', 'en'))
      .toEqual(['milk', 'bread']);
  });

  it('does not split words that happen to contain "and" or "e"', () => {
    expect(splitTranscriptIntoItems('lemonade', 'en')).toEqual(['lemonade']);
    expect(splitTranscriptIntoItems('pere', 'it')).toEqual(['pere']);
  });

  it('returns [] for empty input', () => {
    expect(splitTranscriptIntoItems('', 'en')).toEqual([]);
    expect(splitTranscriptIntoItems('   ', 'it')).toEqual([]);
  });

  it('handles plus sign as separator', () => {
    expect(splitTranscriptIntoItems('milk + bread', 'en')).toEqual(['milk', 'bread']);
  });
});

describe('useSpeechRecognition', () => {
  let lastRec: FakeRecogniser | null = null;

  beforeEach(() => {
    lastRec = null;
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
        lastRec = this as unknown as FakeRecogniser;
      }
    };
  });

  it('reports isSupported=true when SpeechRecognition is on window', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    expect(c.api!.isSupported.value).toBe(true);
  });

  it('reports isSupported=false when no ctor is available', () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    expect(c.api!.isSupported.value).toBe(false);
  });

  it('start() configures lang and flips listening to true', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    c.api!.start('it-IT');
    expect(lastRec!.lang).toBe('it-IT');
    expect(lastRec!.interimResults).toBe(true);
    expect(c.api!.listening.value).toBe(true);
    expect(lastRec!.start).toHaveBeenCalledOnce();
  });

  it('accumulates transcripts as result events arrive', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    c.api!.start();
    lastRec!.onresult!({
      resultIndex: 0,
      results: [[{ transcript: 'milk' }]],
    });
    expect(c.api!.transcript.value).toBe('milk');
  });

  it('onend flips listening back to false', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    c.api!.start();
    lastRec!.onend!();
    expect(c.api!.listening.value).toBe(false);
  });

  it('onerror surfaces the error code', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    c.api!.start();
    lastRec!.onerror!({ error: 'not-allowed' });
    expect(c.api!.error.value).toBe('not-allowed');
  });

  it('stop() flips listening to false and forwards to the underlying recogniser', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    mount(host(c));
    c.api!.start();
    c.api!.stop();
    expect(lastRec!.stop).toHaveBeenCalledOnce();
    expect(c.api!.listening.value).toBe(false);
  });

  it('unmount aborts the recogniser to release the microphone', () => {
    const c: { api?: ReturnType<typeof useSpeechRecognition> } = {};
    const wrapper = mount(host(c));
    c.api!.start();
    wrapper.unmount();
    expect(lastRec!.abort).toHaveBeenCalledOnce();
  });
});
