<script setup lang="ts">
import { ref, computed, useId, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Mic, X, Check } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import {
  useSpeechRecognition,
  splitTranscriptIntoItems,
} from '@/composables/useSpeechRecognition';
import {
  ensureMicrophoneAccess,
  isStandaloneDisplayMode,
  isAndroidMobile,
} from '@/composables/useMicrophonePermission';
import { CATEGORIES } from '@/domain/categories';
import type { Category } from '@/domain/types';

/**
 * S3.3: voice-input sheet. Uses the Web SpeechRecognition API to capture a
 * spoken list, then splits it into discrete item names. The user reviews the
 * inferred rows (with category icons) before committing.
 */
const props = defineProps<{
  open: boolean;
  /** Called per item-name to infer a category. Same contract as bulk-paste. */
  inferCategory: (name: string) => Category;
}>();

const emit = defineEmits<{
  cancel: [];
  submit: [rows: Array<{ name: string; category: Category }>];
}>();

const { t, locale } = useI18n();
const titleId = useId();

const openRef = toRef(props, 'open');
useModalBack(openRef, () => emit('cancel'));

const speech = useSpeechRecognition();

const recognitionLang = computed(() => (locale.value === 'it' ? 'it-IT' : 'en-US'));

const reset = (): void => {
  speech.stop();
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) reset();
  },
);

const startListening = async (): Promise<void> => {
  const micAccess = await ensureMicrophoneAccess();
  if (micAccess === 'denied') {
    speech.reportError('not-allowed');
    return;
  }

  speech.start(recognitionLang.value);
};

const stopListening = (): void => {
  speech.stop();
};

const rows = computed(() => {
  return splitTranscriptIntoItems(speech.transcript.value, locale.value).map((name) => ({
    name,
    category: props.inferCategory(name),
  }));
});

const canSubmit = computed(() => rows.value.length > 0 && !speech.listening.value);

const onSubmit = (): void => {
  if (!canSubmit.value) return;
  emit('submit', rows.value);
};

const showAndroidVoiceHint = computed(
  () => isAndroidMobile() && isStandaloneDisplayMode(),
);

const errorMessageKey = computed<string | null>(() => {
  const e = speech.error.value;
  if (!e) return null;
  if (e === 'not-allowed') {
    if (isAndroidMobile()) return 'item.voicePermissionDeniedAndroid';
    if (isStandaloneDisplayMode()) return 'item.voicePermissionDeniedPwa';
    return 'item.voicePermissionDenied';
  }
  if (e === 'no-speech') return 'item.voiceNoSpeech';
  if (e === 'unsupported') return 'item.voiceUnsupported';
  return 'item.voiceError';
});
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="voice-add-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="emit('cancel')"
    />
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-md rounded-2xl bg-cream p-5 shadow-xl"
      @keydown.esc="emit('cancel')"
    >
      <div class="mb-3">
        <h2 :id="titleId" class="text-base font-semibold text-charcoal">
          {{ t('item.voiceTitle') }}
        </h2>
        <p class="mt-1 text-xs text-muted-gray whitespace-pre-line">
          {{ t('item.voiceHint') }}
        </p>
        <p
          v-if="showAndroidVoiceHint"
          data-testid="voice-android-hint"
          class="mt-2 text-xs text-muted-gray whitespace-pre-line"
        >
          {{ t('item.voiceAndroidHint') }}
        </p>
      </div>

      <div
        v-if="!speech.isSupported.value"
        data-testid="voice-unsupported"
        class="rounded-xl bg-offwhite border border-cream-soft p-4 text-center text-sm text-muted-gray"
      >
        {{ t('item.voiceUnsupported') }}
      </div>

      <template v-else>
        <div class="flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            data-testid="voice-mic"
            :aria-label="speech.listening.value ? t('item.voiceStop') : t('item.voiceStart')"
            :class="[
              'inline-flex h-16 w-16 items-center justify-center rounded-full transition-colors',
              speech.listening.value
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-primary text-white hover:bg-primary-hover',
            ]"
            @click="speech.listening.value ? stopListening() : startListening()"
          >
            <Mic :size="28" :stroke-width="2.25" aria-hidden="true" />
          </button>
          <p
            v-if="speech.listening.value"
            data-testid="voice-listening"
            class="text-xs text-muted-gray"
          >
            {{ t('item.voiceListening') }}
          </p>
        </div>

        <div
          v-if="speech.transcript.value"
          data-testid="voice-transcript"
          class="rounded-xl bg-offwhite border border-cream-soft p-3 text-sm text-charcoal"
        >
          {{ speech.transcript.value }}
        </div>

        <div
          v-if="rows.length > 0"
          data-testid="voice-preview"
          class="mt-3 max-h-32 overflow-y-auto rounded-xl border border-cream-soft bg-offwhite p-2"
        >
          <ul class="flex flex-wrap gap-1.5">
            <li
              v-for="(r, i) in rows"
              :key="`${r.name}-${i}`"
              data-testid="voice-row"
              class="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-1 text-xs text-charcoal"
            >
              <span aria-hidden="true">{{ CATEGORIES[r.category].icon }}</span>
              <span>{{ r.name }}</span>
            </li>
          </ul>
        </div>

        <p
          v-if="errorMessageKey"
          data-testid="voice-error"
          class="mt-3 text-xs text-red-700"
        >
          {{ t(errorMessageKey) }}
        </p>
      </template>

      <div class="mt-5 flex flex-row items-center gap-2">
        <button
          type="button"
          data-testid="voice-cancel"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal hover:bg-black/5 active:bg-black/10"
          @click="emit('cancel')"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('list.cancel') }}
        </button>
        <button
          type="button"
          data-testid="voice-submit"
          :disabled="!canSubmit"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
          @click="onSubmit"
        >
          <Check :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ t('item.bulkPasteCount', { n: rows.length }, rows.length) }}
        </button>
      </div>
    </div>
  </div>
</template>
