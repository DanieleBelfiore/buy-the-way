import { ref, readonly, onBeforeUnmount } from 'vue';

/**
 * S3.3: thin wrapper over the Web Speech API (SpeechRecognition).
 *
 * Browser support is checked lazily so the composable can be imported by
 * any view without crashing on unsupported devices (Firefox desktop, older
 * Safari). Consumers gate their UI on `isSupported`.
 *
 * Lifecycle:
 *  - `start(lang)` begins listening; transcripts arrive on `transcript`.
 *  - `stop()` ends listening explicitly.
 *  - `error` carries the last failure reason ('not-allowed', 'no-speech', etc).
 *  - The recogniser is torn down `onBeforeUnmount` so a hot-reloaded
 *    component never leaks a live microphone stream.
 */

// The Web Speech API ships under two names: standard `SpeechRecognition`
// (Chromium 33+) and vendor-prefixed `webkitSpeechRecognition` (Safari, older
// Chromium). TypeScript's DOM lib does not declare either; we keep things
// loose with `any` here rather than ship a half-baked type for an API the
// spec still revises.

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as SpeechRecognitionCtor | undefined) ??
    (w.webkitSpeechRecognition as SpeechRecognitionCtor | undefined) ??
    null
  );
};

export const useSpeechRecognition = () => {
  const Ctor = getCtor();
  const isSupported = ref(Ctor !== null);
  const listening = ref(false);
  const transcript = ref('');
  const error = ref<string | null>(null);

  let recogniser: SpeechRecognitionLike | null = null;

  const teardown = (): void => {
    if (!recogniser) return;
    try {
      recogniser.onresult = null;
      recogniser.onerror = null;
      recogniser.onend = null;
      recogniser.abort();
    } catch {
      // best-effort
    }
    recogniser = null;
    listening.value = false;
  };

  const start = (lang: string = 'en-US'): void => {
    if (!Ctor) {
      error.value = 'unsupported';
      return;
    }
    teardown();
    transcript.value = '';
    error.value = null;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      let combined = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const alt = ev.results[i];
        if (alt && alt[0]) combined += alt[0].transcript;
      }
      transcript.value = combined;
    };
    rec.onerror = (ev) => {
      error.value = ev.error || 'unknown';
    };
    rec.onend = () => {
      listening.value = false;
    };
    try {
      rec.start();
      listening.value = true;
      recogniser = rec;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'start-failed';
    }
  };

  const stop = (): void => {
    if (!recogniser) return;
    try {
      recogniser.stop();
    } catch {
      // best-effort
    }
    listening.value = false;
  };

  const reportError = (code: string): void => {
    error.value = code;
    listening.value = false;
  };

  onBeforeUnmount(() => teardown());

  return {
    isSupported: readonly(isSupported),
    listening: readonly(listening),
    transcript: readonly(transcript),
    error: readonly(error),
    start,
    stop,
    reportError,
  };
};

/**
 * Split a transcript like "latte, pane e uova" into discrete item names.
 *
 * Locale-aware: Italian uses "e" as conjunction, English uses "and".
 * Punctuation (comma, semicolon, ampersand) split too.
 */
export const splitTranscriptIntoItems = (raw: string, locale: string): string[] => {
  if (!raw.trim()) return [];
  const conjunction = locale.startsWith('it') ? '\\be\\b' : '\\band\\b';
  const splitter = new RegExp(`[,;&]+|\\s+${conjunction}\\s+|\\s\\+\\s`, 'gi');
  return raw
    .split(splitter)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};
