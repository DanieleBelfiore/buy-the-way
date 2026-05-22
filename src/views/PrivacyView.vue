<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';

const { t, tm } = useI18n();
const router = useRouter();

useDocumentHead({
  titleKey: 'seo.privacy.title',
  descriptionKey: 'seo.privacy.description',
});

const goToLogin = (): void => {
  void router.push({ name: 'login' });
};

interface LegalSection {
  id: string;
  heading: string;
  body: string;
}

const sections = computed<LegalSection[]>(() => {
  const raw = tm('legal.privacy.sections') as unknown;
  return Array.isArray(raw) ? (raw as LegalSection[]) : [];
});
</script>

<template>
  <main class="min-h-screen min-h-dvh bg-cream text-charcoal">
    <section class="mx-auto max-w-3xl px-6 pt-16 pb-8 text-center space-y-6">
      <picture>
        <source srcset="/branding/logo-original.avif" type="image/avif" />
        <img
          src="/branding/logo-original.png"
          alt=""
          aria-hidden="true"
          width="1316"
          height="974"
          decoding="async"
          class="mx-auto h-32 w-auto select-none"
          draggable="false"
        />
      </picture>
      <h1 class="text-3xl font-semibold tracking-tight">
        {{ t('about.heroTitle') }}
      </h1>
      <p class="text-lg text-muted-gray">{{ t('about.heroSubtitle') }}</p>
      <button
        type="button"
        class="inline-flex items-center justify-center h-12 px-6 bg-primary text-white text-base font-medium rounded-full hover:bg-primary-hover active:bg-primary-active"
        data-testid="privacy-cta"
        @click="goToLogin"
      >
        {{ t('about.cta') }}
      </button>
    </section>

    <article class="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl font-semibold">{{ t('legal.privacy.title') }}</h1>
        <p class="text-sm text-muted-gray">
          {{ t('legal.privacy.lastUpdated', { date: t('legal.lastUpdated') }) }}
        </p>
      </header>

      <nav aria-label="Table of contents">
        <ol class="list-decimal list-inside space-y-1 text-sm">
          <li v-for="s in sections" :key="s.id">
            <a :href="`#${s.id}`" class="underline">{{ s.heading }}</a>
          </li>
        </ol>
      </nav>

      <section v-for="s in sections" :id="s.id" :key="s.id" class="space-y-2">
        <h2 class="text-lg font-semibold">{{ s.heading }}</h2>
        <p class="whitespace-pre-line text-base text-muted-gray">{{ s.body }}</p>
      </section>
    </article>

    <LegalFooter />
  </main>
</template>
