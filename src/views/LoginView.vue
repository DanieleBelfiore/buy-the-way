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
      <!-- Logo + Wordmark -->
      <div class="text-center space-y-3">
        <img
          src="/branding/logo-original.png"
          alt=""
          aria-hidden="true"
          class="login-logo mx-auto h-50 w-auto"
        />
      </div>

      <!-- CTA -->
      <div class="space-y-3">
        <button
          data-testid="sign-in-btn"
          :disabled="loading || undefined"
          class="w-full h-12 px-5 bg-primary text-offwhite text-base font-medium rounded-full
                 hover:bg-primary-hover active:bg-primary-active
                 flex items-center justify-center gap-3
                 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleSignIn"
        >
          <span
            v-if="loading"
            class="w-5 h-5 border-2 border-offwhite/30 border-t-offwhite rounded-full animate-spin"
            aria-hidden="true"
          />
          <img
            v-else
            src="/branding/google-g.svg"
            alt=""
            aria-hidden="true"
            class="w-6 h-6"
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

<style scoped>
.login-logo {
  animation: login-logo-in 600ms ease-out both;
}
@keyframes login-logo-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .login-logo {
    animation: none;
  }
}
</style>
