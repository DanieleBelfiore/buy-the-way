<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

// Redirect as soon as Firebase resolves the authenticated user.
// The guard only runs during navigation, so we must watch here too.
watch(
  () => auth.user,
  (user) => {
    if (user) router.push({ name: 'lists' });
  },
);

const loading = ref(false);
const error = ref<string | null>(null);

const handleSignIn = async () => {
  loading.value = true;
  error.value = null;
  try {
    await auth.signIn();
  } catch {
    error.value = t('auth.signInError');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm space-y-10">
      <!-- Wordmark -->
      <div class="text-center space-y-2">
        <h1 class="text-2xl font-semibold text-charcoal tracking-tight">
          {{ t('app.name') }}
        </h1>
        <p class="text-sm text-muted-gray">{{ t('app.tagline') }}</p>
      </div>

      <!-- CTA -->
      <div class="space-y-3">
        <button
          data-testid="sign-in-btn"
          :disabled="loading || undefined"
          class="w-full py-3 px-6 bg-charcoal text-offwhite text-sm font-medium rounded-xl
                 flex items-center justify-center gap-2
                 disabled:opacity-50 disabled:cursor-not-allowed
                 active:scale-95 transition-transform"
          @click="handleSignIn"
        >
          <span
            v-if="loading"
            class="w-4 h-4 border-2 border-offwhite/30 border-t-offwhite rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{{ loading ? t('auth.signingIn') : t('auth.continueWithGoogle') }}</span>
        </button>

        <p
          v-if="error"
          data-testid="sign-in-error"
          role="alert"
          class="text-sm text-center text-muted-gray"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </main>
</template>
