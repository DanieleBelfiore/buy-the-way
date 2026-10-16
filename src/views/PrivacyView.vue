<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import PublicHeader from '@/components/public/PublicHeader.vue';
import LegalArticle, { type LegalSection } from '@/components/public/LegalArticle.vue';

const { t, tm } = useI18n();

useDocumentHead({
  titleKey: 'seo.privacy.title',
  descriptionKey: 'seo.privacy.description',
});

const sections = computed<LegalSection[]>(() => {
  const raw = tm('legal.privacy.sections') as unknown;
  return Array.isArray(raw) ? (raw as LegalSection[]) : [];
});
</script>

<template>
  <main class="public-grain min-h-dvh bg-cream text-charcoal flex flex-col">
    <PublicHeader />
    <LegalArticle
      :title="t('legal.privacy.title')"
      :updated="t('legal.privacy.lastUpdated', { date: t('legal.privacyLastUpdated') })"
      :sections="sections"
    />
    <LegalFooter />
  </main>
</template>
