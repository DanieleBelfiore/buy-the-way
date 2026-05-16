<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { setLocale } from '@/i18n';
import type { Locale } from '@/domain/types';

const router = useRouter();
const authStore = useAuthStore();
const { t, locale } = useI18n();
const signingOut = ref(false);

const currentLocale = computed<Locale>(() => locale.value as Locale);
const user = computed(() => authStore.user);

const handleSetLocale = (next: Locale) => {
  setLocale(next);
};

const handleSignOut = async () => {
  signingOut.value = true;
  try {
    await authStore.signOut();
    router.push({ name: 'login' });
  } finally {
    signingOut.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen bg-cream">
    <header class="px-5 pt-12 pb-4 flex items-center gap-3">
      <button
        class="text-charcoal"
        :aria-label="t('settings.title')"
        @click="router.back()"
      >
        ←
      </button>
      <h1 class="text-xl font-semibold text-charcoal tracking-tight">
        {{ t('settings.title') }}
      </h1>
    </header>

    <section class="px-5 pt-6">
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.language') }}
      </h2>
      <div
        role="radiogroup"
        :aria-label="t('settings.language')"
        class="flex gap-2"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="currentLocale === 'it'"
          data-testid="locale-it"
          :class="[
            'flex-1 px-4 py-3 rounded-xl font-medium border transition-colors',
            currentLocale === 'it'
              ? 'bg-charcoal text-white border-charcoal'
              : 'bg-white text-charcoal border-cream-soft',
          ]"
          @click="handleSetLocale('it')"
        >
          Italiano
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="currentLocale === 'en'"
          data-testid="locale-en"
          :class="[
            'flex-1 px-4 py-3 rounded-xl font-medium border transition-colors',
            currentLocale === 'en'
              ? 'bg-charcoal text-white border-charcoal'
              : 'bg-white text-charcoal border-cream-soft',
          ]"
          @click="handleSetLocale('en')"
        >
          English
        </button>
      </div>
    </section>

    <section
      v-if="user"
      data-testid="account-section"
      class="px-5 pt-8"
    >
      <h2 class="text-xs uppercase tracking-wide text-muted-gray mb-2">
        {{ t('settings.account') }}
      </h2>
      <div class="bg-white rounded-xl border border-cream-soft px-4 py-3">
        <div
          v-if="user.displayName"
          class="text-charcoal font-medium"
        >
          {{ user.displayName }}
        </div>
        <div class="text-sm text-muted-gray">
          {{ user.email }}
        </div>
      </div>
    </section>

    <section class="px-5 pt-8">
      <button
        :disabled="signingOut"
        data-testid="sign-out-btn"
        class="w-full px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl
               disabled:opacity-40 text-left"
        @click="handleSignOut"
      >
        {{ signingOut ? t('auth.signingIn') : t('settings.signOut') }}
      </button>
    </section>
  </main>
</template>
