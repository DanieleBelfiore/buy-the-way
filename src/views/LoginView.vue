<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Wordmark from '@/components/ui/Wordmark.vue';
import Button from '@/components/ui/Button.vue';
import IconGoogleG from '@/components/ui/icons/IconGoogleG.vue';

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const toggleLocale = (): void => {
  locale.value = locale.value === 'it' ? 'en' : 'it';
};

const handleGoogleSignIn = async (): Promise<void> => {
  await auth.signIn();
  await router.push('/');
};
</script>

<template>
  <div
    class="login"
    data-view="LoginView"
  >
    <header class="login__header">
      <Wordmark size="md" />
      <button
        type="button"
        class="login__lang-toggle label"
        data-testid="lang-toggle"
        :aria-label="t('auth.languageToggle')"
        @click="toggleLocale"
      >
        {{ locale === 'it' ? 'EN' : 'IT' }}
      </button>
    </header>

    <main class="login__main">
      <p class="login__hero">
        {{ t('auth.hero') }}
      </p>

      <Button
        variant="dark"
        full
        data-testid="google-cta"
        @click="handleGoogleSignIn"
      >
        <IconGoogleG :size="20" />
        {{ t('auth.googleCta') }}
      </Button>
    </main>
  </div>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--cream);
  padding: var(--space-6) var(--space-5);
}

.login__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login__lang-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--charcoal);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  transition: background-color 150ms ease;
}

.login__lang-toggle:hover {
  background: var(--cream-soft);
}

.login__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--space-6);
  padding-bottom: var(--space-10);
}

.login__hero {
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.2;
  color: var(--charcoal);
  max-width: 18ch;
}
</style>
