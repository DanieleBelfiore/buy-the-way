<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';

const { t, tm } = useI18n();

useDocumentHead({
  titleKey: 'seo.terms.title',
  descriptionKey: 'seo.terms.description',
});

interface LegalSection {
  id: string;
  heading: string;
  body: string;
}

const sections = computed<LegalSection[]>(() => {
  const raw = tm('legal.terms.sections') as unknown;
  return Array.isArray(raw) ? (raw as LegalSection[]) : [];
});
</script>

<template>
  <main class="min-h-screen bg-cream text-charcoal">
    <article class="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl font-semibold">{{ t('legal.terms.title') }}</h1>
        <p class="text-sm text-muted-gray">
          {{ t('legal.terms.lastUpdated', { date: t('legal.lastUpdated') }) }}
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
