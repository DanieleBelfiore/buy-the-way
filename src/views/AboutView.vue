<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@unhead/vue';
import { useRouter } from 'vue-router';
import { useDocumentHead } from '@/composables/useDocumentHead';
import { safeJsonLd } from '@/domain/jsonld';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import PublicHeader from '@/components/public/PublicHeader.vue';
import { ArrowRight } from '@lucide/vue';

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

interface FeatureEntry {
  term: string;
  desc: string;
}

const features = computed<FeatureEntry[]>(() => {
  const raw = tm('about.features') as unknown;
  return Array.isArray(raw) ? (raw as FeatureEntry[]) : [];
});

const faqJsonLd = computed(() =>
  safeJsonLd({
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
  safeJsonLd({
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
      innerHTML: () => faqJsonLd.value,
      'data-jsonld': 'faq',
    },
    {
      type: 'application/ld+json',
      innerHTML: () => webAppJsonLd.value,
      'data-jsonld': 'webapp',
    },
  ],
});

const goToLogin = (): void => {
  void router.push({ name: 'login' });
};
</script>

<template>
  <main class="public-grain min-h-dvh bg-cream text-charcoal flex flex-col">
    <PublicHeader />

    <header class="mx-auto w-full max-w-6xl px-6 pt-12 pb-20 sm:pt-16 lg:pt-24 lg:pb-28">
      <h1
        class="max-w-4xl font-display font-medium text-balance
               text-[clamp(2.4rem,5.6vw,4.25rem)] leading-[1.04] tracking-[-0.025em]"
      >
        {{ t('about.heroTitle') }}
      </h1>
      <p class="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted-gray text-pretty sm:text-xl">
        {{ t('about.heroSubtitle') }}
      </p>
    </header>

    <section
      class="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-20 lg:grid-cols-12 lg:pb-28"
      aria-labelledby="about-features-title"
    >
      <h2
        id="about-features-title"
        class="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.015em] lg:col-span-4"
      >
        {{ t('about.featuresTitle') }}
      </h2>
      <dl class="border-b border-charcoal/10 lg:col-span-8">
        <div
          v-for="(feature, idx) in features"
          :key="idx"
          class="grid gap-1 border-t border-charcoal/10 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6"
        >
          <dt class="font-semibold">{{ feature.term }}</dt>
          <dd class="text-muted-gray text-pretty">{{ feature.desc }}</dd>
        </div>
      </dl>
    </section>

    <section
      class="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-24 lg:grid-cols-12 lg:pb-32"
      aria-labelledby="about-faq-title"
    >
      <h2
        id="about-faq-title"
        class="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.015em] lg:col-span-4"
      >
        {{ t('about.faqTitle') }}
      </h2>
      <dl class="border-b border-charcoal/10 lg:col-span-8">
        <div
          v-for="(faq, idx) in faqs"
          :key="idx"
          class="grid gap-2 border-t border-charcoal/10 py-6 md:grid-cols-2 md:gap-8"
        >
          <dt class="text-lg font-semibold leading-snug text-balance">{{ faq.q }}</dt>
          <dd class="leading-relaxed text-muted-gray text-pretty">{{ faq.a }}</dd>
        </div>
      </dl>
    </section>

    <section
      class="w-full bg-cream-soft"
      aria-labelledby="about-closing-title"
    >
      <div
        class="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-20
               sm:flex-row sm:items-end sm:justify-between lg:py-24"
      >
        <h2
          id="about-closing-title"
          class="max-w-2xl font-display text-[clamp(2rem,4.4vw,3.25rem)] font-medium leading-[1.05]
                 tracking-[-0.02em] text-balance"
        >
          {{ t('about.closingTitle') }}
        </h2>
        <button
          type="button"
          data-testid="about-cta"
          class="group inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-full
                 bg-primary pl-7 pr-6 text-base font-medium text-white shadow-lift
                 transition-[transform,background-color] duration-200 ease-out
                 hover:-translate-y-0.5 hover:bg-primary-hover
                 active:translate-y-0 active:scale-[0.98] active:bg-primary-active
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                 focus-visible:ring-offset-cream-soft focus-visible:ring-primary
                 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          @click="goToLogin"
        >
          <span>{{ t('about.cta') }}</span>
          <ArrowRight
            :size="18"
            :stroke-width="2.25"
            aria-hidden="true"
            class="transition-transform duration-200 group-hover:translate-x-0.5
                   motion-reduce:transition-none"
          />
        </button>
      </div>
    </section>

    <LegalFooter />
  </main>
</template>
