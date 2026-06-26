<script setup lang="ts">
import { ref, useId, watch, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { Send, X } from '@lucide/vue';
import { useModalBack } from '@/composables/useModalBack';
import { useFocusTrap } from '@/composables/useFocusTrap';
import pkg from '../../../package.json';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; submitted: [] }>();

const { t } = useI18n();
const titleId = useId();

const message = ref('');
const sending = ref(false);
const errorMsg = ref<string | null>(null);

// Reset internal state every time the modal opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      message.value = '';
      sending.value = false;
      errorMsg.value = null;
    }
  },
);

// Encode an object as application/x-www-form-urlencoded - what Netlify Forms
// expects from JS-driven SPA submissions.
const encodeForm = (data: Record<string, string>): string =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const cancel = (): void => {
  if (sending.value) return;
  emit('close');
};

const openRef = toRef(props, 'open');
useModalBack(openRef, cancel);
const dialogRef = ref<HTMLElement | null>(null);
useFocusTrap(openRef, dialogRef);

const submit = async (): Promise<void> => {
  const text = message.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  errorMsg.value = null;
  try {
    // Read current user lazily so this component doesn't have to mock the
    // store in tests that just want to render the form.
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    const body = encodeForm({
      'form-name': 'feedback',
      'bot-field': '', // honeypot - bots fill it, humans don't
      email: auth.user?.email ?? '',
      uid: auth.user?.uid ?? '',
      userAgent: navigator.userAgent,
      appVersion: pkg.version,
      message: text,
    });
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    emit('submitted');
    emit('close');
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err);
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      data-testid="feedback-modal-backdrop"
      class="absolute inset-0 bg-black/40"
      @click="cancel"
    />
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
      class="relative z-10 mx-5 w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl"
      @keydown.esc="cancel"
    >
      <h2 :id="titleId" class="text-lg font-semibold text-charcoal">
        {{ t('settings.feedbackTitle') }}
      </h2>
      <p class="mt-1 text-sm text-muted-gray">
        {{ t('settings.feedbackHint') }}
      </p>

      <textarea
        v-model="message"
        data-testid="feedback-textarea"
        :aria-label="t('settings.feedbackTitle')"
        :placeholder="t('settings.feedbackPlaceholder')"
        rows="5"
        class="mt-3 w-full resize-y rounded-xl border border-cream-soft bg-offwhite px-3 py-2 text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        :disabled="sending"
      />

      <p
        v-if="errorMsg"
        data-testid="feedback-error"
        role="alert"
        class="mt-2 text-sm text-red-600"
      >
        {{ t('settings.feedbackError') }}
      </p>

      <div class="mt-5 flex flex-row items-center gap-2">
        <button
          data-testid="feedback-cancel"
          type="button"
          :disabled="sending"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm text-charcoal bg-black/5 hover:bg-black/10 active:bg-black/15 transition-colors disabled:opacity-40"
          @click="cancel"
        >
          <X :size="16" :stroke-width="2" aria-hidden="true" />
          {{ t('settings.feedbackCancel') }}
        </button>
        <button
          data-testid="feedback-submit"
          type="button"
          :disabled="sending || !message.trim()"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-40"
          @click="submit"
        >
          <Send :size="16" :stroke-width="2.25" aria-hidden="true" />
          {{ sending ? t('settings.feedbackSending') : t('settings.feedbackSubmit') }}
        </button>
      </div>
    </div>
  </div>
</template>
