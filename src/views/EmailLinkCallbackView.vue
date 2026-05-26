<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

/**
 * Landing page for the magic-link sign-in flow. Firebase appends a token
 * to the URL; this view completes the sign-in, then bounces the user into
 * the app. If the link was opened on a different device than the one that
 * requested it, we surface an inline email prompt before retrying.
 */

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const status = ref<'verifying' | 'needsEmail' | 'error'>('verifying');
const errorMessage = ref<string | null>(null);
const emailDraft = ref('');
const submitting = ref(false);

const complete = async (emailHint?: string): Promise<void> => {
  submitting.value = true;
  errorMessage.value = null;
  try {
    await authStore.completeMagicLinkSignIn(window.location.href, emailHint);
    await router.replace({ name: 'lists' });
  } catch (err) {
    console.error('[EmailLinkCallback] sign-in failed:', err);
    errorMessage.value = err instanceof Error ? err.message : String(err);
    status.value = 'error';
  } finally {
    submitting.value = false;
  }
};

const onSubmitEmail = async (): Promise<void> => {
  const email = emailDraft.value.trim();
  if (!email) return;
  await complete(email);
};

onMounted(async () => {
  if (!authStore.isMagicLinkCallback(window.location.href)) {
    // Someone landed here without a valid magic link - bounce to login.
    await router.replace({ name: 'login' });
    return;
  }
  // Try the happy path first: localStorage carries the requesting email.
  try {
    await authStore.completeMagicLinkSignIn(window.location.href);
    await router.replace({ name: 'lists' });
  } catch {
    // Could be missing-email (link opened on a different device) or a
    // genuinely invalid link. Ask for the email so the user can retry.
    status.value = 'needsEmail';
  }
});
</script>

<template>
  <main class="min-h-dvh bg-cream flex items-center justify-center px-5">
    <div class="w-full max-w-sm rounded-2xl bg-offwhite p-6 shadow-xl">
      <div v-if="status === 'verifying'" data-testid="magic-link-verifying" class="text-center">
        <p class="text-base font-semibold text-charcoal">
          {{ t('auth.magicLink.verifying') }}
        </p>
      </div>

      <form
        v-else-if="status === 'needsEmail'"
        data-testid="magic-link-needs-email"
        class="space-y-3"
        @submit.prevent="onSubmitEmail"
      >
        <p class="text-base font-semibold text-charcoal">
          {{ t('auth.magicLink.confirmEmailTitle') }}
        </p>
        <p class="text-sm text-muted-gray">
          {{ t('auth.magicLink.confirmEmailHint') }}
        </p>
        <input
          v-model="emailDraft"
          type="email"
          autocomplete="email"
          spellcheck="false"
          :aria-label="t('auth.magicLink.emailLabel')"
          :placeholder="t('auth.magicLink.emailLabel')"
          class="w-full px-4 py-3 bg-cream border border-cream-soft rounded-xl text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        />
        <p v-if="errorMessage" class="text-red-600 text-xs">{{ errorMessage }}</p>
        <button
          type="submit"
          data-testid="magic-link-confirm"
          :disabled="submitting || !emailDraft.trim()"
          class="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active disabled:opacity-40"
        >
          {{ submitting ? t('auth.magicLink.completing') : t('auth.magicLink.complete') }}
        </button>
      </form>

      <div v-else data-testid="magic-link-error" class="space-y-3 text-center">
        <p class="text-base font-semibold text-red-700">
          {{ t('auth.magicLink.errorTitle') }}
        </p>
        <p v-if="errorMessage" class="text-xs text-muted-gray">{{ errorMessage }}</p>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active"
          @click="router.replace({ name: 'login' })"
        >
          {{ t('auth.magicLink.backToLogin') }}
        </button>
      </div>
    </div>
  </main>
</template>
