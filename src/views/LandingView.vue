<script setup lang="ts">
import { computed } from 'vue';
import { useI18n, Translation as I18nT } from 'vue-i18n';
import { useHead } from '@unhead/vue';
import { useRouter } from 'vue-router';
import { useDocumentHead } from '@/composables/useDocumentHead';
import { safeJsonLd } from '@/domain/jsonld';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import PublicHeader from '@/components/public/PublicHeader.vue';
import ListMock from '@/components/public/ListMock.vue';
import FeatureVisual from '@/components/public/FeatureVisual.vue';
import { ArrowRight } from '@lucide/vue';
import { prefersReducedMotionSync } from '@/composables/useReducedMotion';

const { t, locale } = useI18n();
const router = useRouter();

useDocumentHead({
  titleKey: 'seo.home.title',
  descriptionKey: 'seo.home.description',
});

type FeatureKey = 'sync' | 'offline' | 'ai';

// Zig-zag rows; privacy has its own full-width band further down.
const FEATURES: readonly FeatureKey[] = ['sync', 'offline', 'ai'];

// Rows rise in as they scroll into view. Off under reduced motion and in e2e,
// where axe would read mid-fade colours.
const isE2E = import.meta.env['VITE_E2E'] === 'true';
const reveal =
  isE2E || prefersReducedMotionSync()
    ? undefined
    : {
        initial: { opacity: 0, y: 28 },
        visibleOnce: {
          opacity: 1,
          y: 0,
          transition: { duration: 650, ease: [0.2, 0.8, 0.2, 1] },
        },
      };

const ctaClass =
  'group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-primary pl-7 pr-6 ' +
  'text-base font-medium text-white shadow-lift transition-[transform,background-color] ' +
  'duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 ' +
  'active:scale-[0.98] active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-cream focus-visible:ring-primary ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

const webAppJsonLd = computed(() =>
  safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Buy The Way',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    description: t('seo.home.description'),
    inLanguage: [locale.value],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: '/branding/og-image.png',
  }),
);

const orgJsonLd = computed(() =>
  safeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Buy The Way',
    url: 'https://buytheway.app/',
    logo: 'https://buytheway.app/branding/logo-square.png',
  }),
);

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: () => webAppJsonLd.value,
      'data-jsonld': 'webapp',
    },
    {
      type: 'application/ld+json',
      innerHTML: () => orgJsonLd.value,
      'data-jsonld': 'org',
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

    <section
      class="mx-auto grid w-full max-w-6xl items-center gap-x-8 gap-y-16 px-6
             pt-10 pb-24 sm:pt-16 lg:grid-cols-12 lg:pt-20 lg:pb-32"
    >
      <div class="space-y-7 lg:col-span-7">
        <h1
          class="font-display font-medium text-balance
                 text-[clamp(2.6rem,6.4vw,4.75rem)] leading-[1.02] tracking-[-0.025em]"
        >
          <I18nT keypath="home.heroTitle" scope="global">
            <template #accent>
              <em class="italic text-primary-ink">{{ t('home.heroTitleAccent') }}</em>
            </template>
          </I18nT>
        </h1>

        <p class="max-w-[34rem] text-lg leading-relaxed text-muted-gray text-pretty sm:text-xl">
          {{ t('home.heroSubtitle') }}
        </p>

        <div class="flex flex-wrap items-center gap-x-6 gap-y-4 pt-1">
          <button
            type="button"
            data-testid="home-cta"
            :class="ctaClass"
            @click="goToLogin"
          >
            <span>{{ t('home.ctaPrimary') }}</span>
            <ArrowRight
              :size="18"
              :stroke-width="2.25"
              aria-hidden="true"
              class="transition-transform duration-200 group-hover:translate-x-0.5
                     motion-reduce:transition-none"
            />
          </button>
          <router-link
            to="/about"
            data-testid="home-secondary"
            class="inline-flex min-h-11 items-center text-base font-medium text-charcoal
                   underline decoration-charcoal/30 underline-offset-[6px]
                   transition-colors duration-200 hover:decoration-charcoal
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                   rounded-sm"
          >
            {{ t('home.ctaSecondary') }}
          </router-link>
        </div>

        <p class="text-sm text-muted-gray">{{ t('home.heroNote') }}</p>
      </div>

      <div class="lg:col-span-5">
        <ListMock />
      </div>
    </section>

    <section
      class="mx-auto w-full max-w-6xl px-6 pb-24 lg:pb-32"
      aria-labelledby="features-title"
    >
      <h2
        id="features-title"
        class="max-w-xl font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.05]
               tracking-[-0.02em] text-balance"
      >
        {{ t('home.highlightsTitle') }}
      </h2>

      <div class="mt-14 space-y-20 lg:mt-20 lg:space-y-28">
        <article
          v-for="(key, idx) in FEATURES"
          :key="key"
          v-motion="reveal"
          class="grid items-center gap-8 lg:grid-cols-12 lg:gap-16"
        >
          <div :class="['min-w-0 lg:col-span-7', idx % 2 === 1 ? 'lg:order-2' : '']">
            <FeatureVisual :kind="key" />
          </div>
          <div :class="['min-w-0 space-y-4 lg:col-span-5', idx % 2 === 1 ? 'lg:order-1' : '']">
            <p class="text-sm font-medium text-muted-gray tabular-nums">
              0{{ idx + 1 }}
              <template v-if="key === 'ai'">
                <span class="px-1.5" aria-hidden="true">/</span>{{ t('home.features.ai.label') }}
              </template>
            </p>
            <h3 class="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.015em] text-balance">
              {{ t(`home.features.${key}.title`) }}
            </h3>
            <p class="max-w-[30rem] text-lg leading-relaxed text-muted-gray text-pretty">
              {{ t(`home.features.${key}.body`) }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <section class="w-full bg-cream-soft" aria-labelledby="privacy-band-title">
      <div v-motion="reveal" class="mx-auto w-full max-w-6xl px-6 pt-24 pb-28 lg:pt-32 lg:pb-36">
        <h2
          id="privacy-band-title"
          class="max-w-4xl font-display text-[clamp(2.25rem,5.4vw,4.25rem)] font-medium
                 leading-[1.04] tracking-[-0.025em] text-balance"
        >
          {{ t('home.privacyBand.statement') }}
        </h2>
        <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted-gray text-pretty">
          {{ t('home.privacyBand.body') }}
        </p>
        <router-link
          to="/privacy"
          class="mt-6 inline-flex min-h-11 items-center rounded-sm text-base font-medium
                 text-charcoal underline decoration-charcoal/30 underline-offset-[6px]
                 transition-colors duration-200 hover:decoration-charcoal
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {{ t('home.privacyBand.link') }}
        </router-link>
      </div>
    </section>

    <section
      v-motion="reveal"
      class="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-6 py-24
             sm:flex-row sm:items-end sm:justify-between lg:py-32"
      aria-labelledby="closing-title"
    >
      <h2
        id="closing-title"
        class="max-w-2xl font-display text-[clamp(2rem,4.4vw,3.5rem)] font-medium leading-[1.05]
               tracking-[-0.02em] text-balance"
      >
        {{ t('home.closing.title') }}
      </h2>
      <button
        type="button"
        data-testid="home-cta-bottom"
        :class="[ctaClass, 'shrink-0']"
        @click="goToLogin"
      >
        <span>{{ t('home.closing.cta') }}</span>
        <ArrowRight
          :size="18"
          :stroke-width="2.25"
          aria-hidden="true"
          class="transition-transform duration-200 group-hover:translate-x-0.5
                 motion-reduce:transition-none"
        />
      </button>
    </section>

    <LegalFooter />
  </main>
</template>
