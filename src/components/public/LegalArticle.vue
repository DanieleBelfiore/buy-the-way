<script setup lang="ts">
import { useI18n } from 'vue-i18n';

export interface LegalSection {
  id: string;
  heading: string;
  body: string;
}

// Shared layout for /privacy and /terms: editorial title, a table of contents
// that sticks beside the text on wide screens, sections at reading width.
defineProps<{
  title: string;
  updated: string;
  sections: LegalSection[];
}>();

const { t } = useI18n();
</script>

<template>
  <article class="mx-auto w-full max-w-6xl px-6 pt-12 pb-24 sm:pt-16 lg:pt-20 lg:pb-32">
    <header class="max-w-3xl">
      <h1
        class="font-display font-medium text-balance
               text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05] tracking-[-0.025em]"
      >
        {{ title }}
      </h1>
      <p class="mt-4 text-sm text-muted-gray tabular-nums">{{ updated }}</p>
    </header>

    <div class="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-16">
      <nav :aria-label="t('legal.toc')" class="lg:col-span-4">
        <ol class="space-y-0.5 text-sm lg:sticky lg:top-8">
          <li v-for="s in sections" :key="s.id">
            <a
              :href="`#${s.id}`"
              class="group flex min-h-10 items-baseline rounded-md py-2 text-charcoal
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                class="underline decoration-transparent underline-offset-4 transition-colors
                       duration-200 group-hover:decoration-current"
              >
                {{ s.heading }}
              </span>
            </a>
          </li>
        </ol>
      </nav>

      <div class="space-y-10 lg:col-span-8">
        <section v-for="s in sections" :id="s.id" :key="s.id" class="scroll-mt-8 space-y-3">
          <h2 class="text-xl font-semibold tracking-tight">{{ s.heading }}</h2>
          <p class="max-w-[65ch] whitespace-pre-line leading-relaxed text-muted-gray text-pretty">
            {{ s.body }}
          </p>
        </section>
      </div>
    </div>
  </article>
</template>
