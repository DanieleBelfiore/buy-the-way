<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHead } from '@unhead/vue';
import { useRoute } from 'vue-router';
import { Check } from '@lucide/vue';
import { useDocumentHead } from '@/composables/useDocumentHead';
import LegalFooter from '@/components/ui/LegalFooter.vue';
import PublicHeader from '@/components/public/PublicHeader.vue';

const { t } = useI18n();
const route = useRoute();

useDocumentHead({
  titleKey: 'seo.notFound.title',
  descriptionKey: 'seo.notFound.description',
});

// The SPA answers every path with 200, so tell crawlers not to index it.
useHead({ meta: [{ name: 'robots', content: 'noindex' }] });

// The missing path, shown as the one unticked item that cannot be found.
const missingPath = computed(() => route.path);
</script>

<template>
  <main class="public-grain min-h-dvh bg-cream text-charcoal flex flex-col">
    <PublicHeader />

    <section
      class="mx-auto grid w-full max-w-6xl flex-1 items-center gap-x-8 gap-y-14 px-6
             pt-10 pb-24 sm:pt-16 lg:grid-cols-12 lg:pt-20"
    >
      <div class="space-y-6 lg:col-span-7">
        <h1
          class="font-display font-medium text-balance
                 text-[clamp(2.4rem,5.6vw,4.25rem)] leading-[1.04] tracking-[-0.025em]"
        >
          {{ t('notFound.title') }}
        </h1>
        <p class="max-w-[34rem] text-lg leading-relaxed text-muted-gray text-pretty">
          {{ t('notFound.body') }}
        </p>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-4 pt-1">
          <router-link
            to="/"
            data-testid="not-found-home"
            class="inline-flex h-13 items-center justify-center rounded-full bg-primary px-7
                   text-base font-medium text-white shadow-lift
                   transition-[transform,background-color] duration-200 ease-out
                   hover:-translate-y-0.5 hover:bg-primary-hover
                   active:translate-y-0 active:scale-[0.98] active:bg-primary-active
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                   focus-visible:ring-offset-cream focus-visible:ring-primary
                   motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {{ t('notFound.home') }}
          </router-link>
          <router-link
            to="/lists"
            class="inline-flex min-h-11 items-center rounded-sm text-base font-medium
                   text-charcoal underline decoration-charcoal/30 underline-offset-[6px]
                   transition-colors duration-200 hover:decoration-charcoal
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {{ t('notFound.lists') }}
          </router-link>
        </div>
      </div>

      <div aria-hidden="true" class="select-none lg:col-span-5">
        <div
          class="mx-auto w-full max-w-[20rem] rounded-[1.75rem] bg-offwhite px-5 py-4 shadow-lift
                 ring-1 ring-charcoal/[0.06] lg:rotate-[-2deg]"
        >
          <div
            v-for="item in [t('notFound.checked1'), t('notFound.checked2')]"
            :key="item"
            class="flex min-h-10 items-center gap-3"
          >
            <span
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                     bg-primary text-white"
            >
              <Check :size="12" :stroke-width="3" />
            </span>
            <span class="text-sm font-medium text-muted-gray line-through">{{ item }}</span>
          </div>
          <div class="flex min-h-10 items-center gap-3">
            <span
              class="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-muted-gray/60"
            />
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-charcoal">
              {{ missingPath }}
            </span>
            <span class="text-sm font-semibold text-muted-gray">?</span>
          </div>
        </div>
      </div>
    </section>

    <LegalFooter />
  </main>
</template>
