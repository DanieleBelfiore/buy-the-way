<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useLogoMotion } from '@/composables/useLogoMotion';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue';
import { Send, X, Info } from '@lucide/vue';
import pkg from '../../package.json';

const APP_VERSION = pkg.version;

const { t, locale } = useI18n();

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

// S2.3: magic-link sign-in. Shown collapsed behind a toggle so the Google
// CTA stays primary; users who can't / don't want Google get an alternative
// without extra friction at first paint.
const showMagicLink = ref(false);
const magicLinkEmail = ref('');
const magicLinkSending = ref(false);
const magicLinkSent = ref(false);

const toggleMagicLink = (): void => {
  showMagicLink.value = !showMagicLink.value;
  if (showMagicLink.value) magicLinkSent.value = false;
};

const handleMagicLink = async (): Promise<void> => {
  const email = magicLinkEmail.value.trim();
  if (!email || magicLinkSending.value) return;
  magicLinkSending.value = true;
  error.value = null;
  try {
    await auth.sendMagicLink(email, locale.value as 'it' | 'en');
    magicLinkSent.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('auth.signInError');
  } finally {
    magicLinkSending.value = false;
  }
};

const useAnotherMagicLinkEmail = (): void => {
  magicLinkSent.value = false;
};
</script>

<template>
  <main class="min-h-dvh bg-cream flex flex-col items-center px-6 relative">
    <div class="absolute top-4 right-4">
      <LocaleSwitcher />
    </div>
    <div class="w-full max-w-sm space-y-10 flex-1 flex flex-col justify-center">
      <!-- Logo + Wordmark -->
      <div class="text-center space-y-3">
        <picture>
          <source
            srcset="/branding/logo-540.avif 1x, /branding/logo-original.avif 2x"
            type="image/avif"
          />
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
          v-if="!showMagicLink"
          data-testid="sign-in-btn"
          :disabled="loading || undefined"
          class="w-full h-12 px-5 bg-primary text-white text-base font-medium rounded-full
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

        <!-- Magic-link alternative. Toggle replaces Google button while the form is open. -->
        <button
          v-if="!showMagicLink"
          type="button"
          data-testid="magic-link-toggle"
          class="w-full h-12 px-5 bg-cream-soft text-charcoal text-base font-medium rounded-full
                 border border-charcoal/15
                 hover:bg-cream active:bg-cream
                 flex items-center justify-center gap-3
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
          @click="toggleMagicLink"
        >
          {{ t('auth.magicLink.show') }}
        </button>

        <div v-if="showMagicLink" data-testid="magic-link-form" class="space-y-2">
          <template v-if="!magicLinkSent">
            <input
              v-model="magicLinkEmail"
              type="email"
              autocomplete="email"
              spellcheck="false"
              :aria-label="t('auth.magicLink.emailLabel')"
              :placeholder="t('auth.magicLink.emailLabel')"
              class="w-full px-4 py-3 bg-offwhite border border-cream-soft rounded-xl text-sm text-charcoal placeholder-muted-gray focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              :disabled="magicLinkSending"
              @keydown.enter="handleMagicLink"
            />
            <div class="flex gap-2">
              <button
                type="button"
                data-testid="magic-link-cancel"
                :disabled="magicLinkSending"
                class="flex-1 h-12 px-5 bg-cream-soft text-charcoal text-base font-medium rounded-full
                       border border-charcoal/15
                       hover:bg-cream active:bg-cream
                       flex items-center justify-center gap-3
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40
                       disabled:opacity-50 disabled:cursor-not-allowed"
                @click="toggleMagicLink"
              >
                <X class="w-5 h-5" aria-hidden="true" />
                <span>{{ t('auth.magicLink.cancel') }}</span>
              </button>
              <button
                type="button"
                data-testid="magic-link-send"
                :disabled="magicLinkSending || !magicLinkEmail.trim()"
                class="flex-1 h-12 px-5 bg-primary text-white text-base font-medium rounded-full
                       hover:bg-primary-hover active:bg-primary-active
                       flex items-center justify-center gap-3
                       disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleMagicLink"
              >
                <span
                  v-if="magicLinkSending"
                  class="w-5 h-5 border-2 border-offwhite/30 border-t-offwhite rounded-full animate-spin"
                  aria-hidden="true"
                />
                <Send v-else class="w-5 h-5" aria-hidden="true" />
                <span>{{ magicLinkSending ? t('auth.magicLink.sending') : t('auth.magicLink.send') }}</span>
              </button>
            </div>
          </template>
          <template v-else>
            <div
              data-testid="magic-link-sent"
              role="status"
              class="flex items-start gap-3 rounded-xl px-1 py-2 text-base font-medium text-primary"
            >
              <Info :size="22" :stroke-width="2" class="shrink-0 mt-0.5" aria-hidden="true" />
              <p class="text-left leading-snug">
                {{ t('auth.magicLink.sentNotice', { email: magicLinkEmail.trim() }) }}
              </p>
            </div>
            <button
              type="button"
              data-testid="magic-link-use-another-email"
              class="w-full h-12 px-5 bg-cream-soft text-charcoal text-base font-medium rounded-full
                     border border-charcoal/15
                     hover:bg-cream active:bg-cream
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
              @click="useAnotherMagicLinkEmail"
            >
              {{ t('auth.magicLink.useAnotherEmail') }}
            </button>
          </template>
        </div>
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
          class="underline"
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
