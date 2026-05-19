<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@unhead/vue';
import { useRouter } from 'vue-router';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';

const { t, tm, locale } = useI18n();
const router = useRouter();

useDocumentHead({
  titleKey: 'seo.about.title',
  descriptionKey: 'seo.about.description',
});

interface FaqEntry {
  q: string;
  a: string;
}

const faqs = computed<FaqEntry[]>(() => {
  const raw = tm('about.faq') as unknown;
  return Array.isArray(raw) ? (raw as FaqEntry[]) : [];
});

const features = computed<string[]>(() => {
  const raw = tm('about.features') as unknown;
  return Array.isArray(raw) ? (raw as string[]) : [];
});

const faqJsonLd = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.value.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }),
);

const webAppJsonLd = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Buy The Way',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    description: t('seo.about.description'),
    inLanguage: [locale.value],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: '/branding/og-image.png',
  }),
);

useHead({
  script: [
    {
      type: 'application/ld+json',
      children: () => faqJsonLd.value,
      'data-jsonld': 'faq',
    },
    {
      type: 'application/ld+json',
      children: () => webAppJsonLd.value,
      'data-jsonld': 'webapp',
    },
  ],
});

const goToLogin = (): void => {
  void router.push({ name: 'login' });
};
</script>

<template>
  <main class="min-h-screen bg-cream text-charcoal">
    <section class="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center space-y-6">
      <img
        src="/branding/logo-original.png"
        alt=""
        aria-hidden="true"
        class="mx-auto h-32 w-auto select-none"
        draggable="false"
      />
      <h1 class="text-3xl font-semibold tracking-tight">
        {{ t('about.heroTitle') }}
      </h1>
      <p class="text-lg text-muted-gray">{{ t('about.heroSubtitle') }}</p>
      <button
        type="button"
        class="inline-flex items-center justify-center h-12 px-6 bg-primary text-offwhite text-base font-medium rounded-full hover:bg-primary-hover active:bg-primary-active"
        data-testid="about-cta"
        @click="goToLogin"
      >
        {{ t('about.cta') }}
      </button>
    </section>

    <section class="mx-auto max-w-3xl px-6 py-8">
      <h2 class="text-xl font-semibold mb-4">{{ t('about.featuresTitle') }}</h2>
      <ul class="space-y-2 list-disc list-inside text-base">
        <li v-for="(feature, idx) in features" :key="idx">{{ feature }}</li>
      </ul>
    </section>

    <section class="mx-auto max-w-3xl px-6 py-8">
      <h2 class="text-xl font-semibold mb-4">{{ t('about.faqTitle') }}</h2>
      <dl class="space-y-4">
        <div v-for="(faq, idx) in faqs" :key="idx" class="border-b border-charcoal/10 pb-4">
          <dt class="font-medium">{{ faq.q }}</dt>
          <dd class="mt-2 text-muted-gray">{{ faq.a }}</dd>
        </div>
      </dl>
    </section>

    <LegalFooter />
  </main>
</template>
