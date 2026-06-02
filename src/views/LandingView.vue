<script setup lang="ts">
import { computed, type FunctionalComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@unhead/vue';
import { useRouter } from 'vue-router';
import { useDocumentHead } from '@/composables/useDocumentHead';
import { useLogoMotion } from '@/composables/useLogoMotion';
import { safeJsonLd } from '@/domain/jsonld';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue';
import { RefreshCw, WifiOff, ShieldCheck } from '@lucide/vue';

const { t, tm, locale } = useI18n();
const router = useRouter();
const logoMotion = useLogoMotion();

useDocumentHead({
  titleKey: 'seo.home.title',
  descriptionKey: 'seo.home.description',
});

interface Highlight {
  title: string;
  body: string;
}

// Icons pair with highlights by index; the copy lives in i18n so the order
// here must mirror home.highlights (sync, offline, privacy).
const ICONS: readonly FunctionalComponent[] = [RefreshCw, WifiOff, ShieldCheck];

const highlights = computed(() => {
  const raw = tm('home.highlights') as unknown;
  const list = Array.isArray(raw) ? (raw as Highlight[]) : [];
  return list.map((h, idx) => ({ ...h, icon: ICONS[idx] ?? ICONS[0] }));
});

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
    url: 'https://buy-the-way.danielebelfiore.dev/',
    logo: 'https://buy-the-way.danielebelfiore.dev/branding/logo-square.png',
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

const goToAbout = (): void => {
  void router.push({ name: 'about' });
};
</script>

<template>
  <main class="min-h-dvh bg-cream text-charcoal flex flex-col">
    <div class="absolute top-4 right-4 z-10">
      <LocaleSwitcher />
    </div>

    <section
      class="flex-1 flex flex-col items-center justify-center text-center
             mx-auto w-full max-w-3xl px-6 pt-20 pb-12 space-y-7"
    >
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
          data-testid="home-logo"
          width="540"
          height="399"
          fetchpriority="high"
          decoding="async"
          class="mx-auto h-48 sm:h-56 w-auto select-none"
          draggable="false"
        />
      </picture>

      <h1 class="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
        {{ t('home.heroTitle') }}
      </h1>

      <p class="text-lg text-muted-gray max-w-xl text-pretty">
        {{ t('home.heroSubtitle') }}
      </p>

      <div class="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          data-testid="home-cta"
          class="inline-flex items-center justify-center h-12 px-7 bg-primary text-white
                 text-base font-medium rounded-full
                 hover:bg-primary-hover active:bg-primary-active
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                 focus-visible:ring-offset-cream focus-visible:ring-primary"
          @click="goToLogin"
        >
          {{ t('home.ctaPrimary') }}
        </button>
        <button
          type="button"
          data-testid="home-secondary"
          class="inline-flex items-center justify-center h-12 px-7 bg-cream-soft text-charcoal
                 text-base font-medium rounded-full border border-charcoal/15
                 hover:bg-cream active:bg-cream
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                 focus-visible:ring-offset-cream focus-visible:ring-primary"
          @click="goToAbout"
        >
          {{ t('home.ctaSecondary') }}
        </button>
      </div>
    </section>

    <section
      class="mx-auto w-full max-w-4xl px-6 pb-16"
      :aria-label="t('home.highlightsTitle')"
    >
      <h2 class="sr-only">{{ t('home.highlightsTitle') }}</h2>
      <ul class="grid gap-5 sm:grid-cols-3">
        <li
          v-for="(h, idx) in highlights"
          :key="idx"
          class="rounded-2xl bg-offwhite border border-charcoal/10 p-6 text-left space-y-3"
        >
          <span
            class="inline-flex items-center justify-center h-11 w-11 rounded-xl
                   bg-primary/10 text-primary"
          >
            <component :is="h.icon" class="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 class="text-lg font-semibold">{{ h.title }}</h3>
          <p class="text-base text-muted-gray">{{ h.body }}</p>
        </li>
      </ul>
    </section>

    <LegalFooter />
  </main>
</template>
