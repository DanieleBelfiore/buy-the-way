<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue';
import '@/styles/public.css';

withDefaults(defineProps<{ showSignIn?: boolean }>(), { showSignIn: true });

const { t } = useI18n();
</script>

<template>
  <header
    class="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 pt-4 pb-2 sm:gap-4 sm:px-6"
    data-testid="public-header"
  >
    <router-link
      to="/"
      :aria-label="t('public.header.home')"
      class="group -ml-1 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-1
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <img
        src="/branding/logo-icon-80.png"
        alt=""
        width="72"
        height="80"
        decoding="async"
        draggable="false"
        class="h-8 w-auto select-none sm:h-9 transition-transform duration-300 ease-out
               group-hover:-rotate-6 motion-reduce:transition-none"
      />
      <span class="hidden whitespace-nowrap font-display text-lg font-semibold tracking-tight min-[360px]:inline sm:text-xl">
        Buy The Way
      </span>
    </router-link>

    <nav class="flex shrink-0 items-center" :aria-label="t('public.header.nav')">
      <LocaleSwitcher />
      <router-link
        v-if="showSignIn"
        to="/login"
        data-testid="public-header-signin"
        class="ml-1 inline-flex h-11 items-center whitespace-nowrap rounded-full px-3 text-base font-medium sm:px-4
               text-charcoal transition-colors duration-200 hover:bg-charcoal/[0.06]
               active:bg-charcoal/10 focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-primary"
      >
        {{ t('public.header.signIn') }}
      </router-link>
    </nav>
  </header>
</template>
