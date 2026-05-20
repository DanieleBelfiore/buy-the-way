<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useLogoMotion } from '@/composables/useLogoMotion';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import pkg from '../../package.json';

const APP_VERSION = pkg.version;

const { t } = useI18n();

useDocumentHead({
  titleKey: 'seo.login.title',
  descriptionKey: 'seo.login.description',
});
const router = useRouter();
const auth = useAuthStore();

const logoMotion = useLogoMotion();

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
  <main class="min-h-screen bg-cream flex flex-col items-center px-6">
    <div class="w-full max-w-sm space-y-10 flex-1 flex flex-col justify-center">
      <!-- Logo + Wordmark -->
      <div class="text-center space-y-3">
        <picture>
          <source srcset="/branding/logo-540.avif" type="image/avif" />
          <img
            v-motion="logoMotion"
            src="/branding/logo-original.png"
            alt=""
            aria-hidden="true"
            data-testid="login-logo"
            width="540"
            height="399"
            fetchpriority="high"
            decoding="async"
            class="mx-auto h-50 w-auto select-none"
            draggable="false"
          />
        </picture>
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
            width="24"
            height="24"
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
    <div class="w-full pb-3">
      <LegalFooter dense />
      <p
        data-testid="made-by"
        class="px-5 text-center text-xs text-muted-gray leading-loose"
      >
        {{ t('app.madeByPrefix') }}<a
          href="https://www.linkedin.com/in/danielebelfiore/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline inline-block min-h-[44px] px-2 py-2 align-middle"
        >Daniele Belfiore</a>{{ t('app.madeBySuffix') }}
      </p>
      <footer
        data-testid="app-version"
        class="px-5 text-center text-xs text-muted-gray"
      >
        v{{ APP_VERSION }}
      </footer>
    </div>
  </main>
</template>
