<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import '@/styles/public.css';

withDefaults(defineProps<{ dense?: boolean }>(), { dense: false });

const { t } = useI18n();

// Read at visit time, not build time, so the footer never shows a stale year.
const year = new Date().getFullYear();
</script>

<template>
  <footer
    v-if="dense"
    class="mx-auto max-w-3xl px-6 pt-4 text-xs text-muted-gray"
    :style="{ paddingBottom: '0px' }"
  >
    <nav aria-label="Legal" class="flex flex-wrap justify-center gap-x-2 gap-y-1">
      <router-link to="/about" class="underline inline-flex items-center px-2 py-1">
        {{ t('legal.footer.about') }}
      </router-link>
      <router-link to="/privacy" class="underline inline-flex items-center px-2 py-1">
        {{ t('legal.footer.privacy') }}
      </router-link>
      <router-link to="/terms" class="underline inline-flex items-center px-2 py-1">
        {{ t('legal.footer.terms') }}
      </router-link>
    </nav>
  </footer>

  <footer
    v-else
    class="mt-auto w-full border-t border-charcoal/10"
    :style="{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }"
  >
    <div
      class="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-10 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <div class="space-y-1.5">
        <p class="font-display text-lg font-semibold tracking-tight">Buy The Way</p>
        <p class="max-w-[40ch] text-sm text-muted-gray text-pretty">
          {{ t('legal.footer.claim') }}
        </p>
      </div>
      <nav aria-label="Legal" class="-mx-2 flex flex-wrap gap-x-1 text-sm">
        <router-link to="/about" class="footer-link">{{ t('legal.footer.about') }}</router-link>
        <router-link to="/privacy" class="footer-link">{{ t('legal.footer.privacy') }}</router-link>
        <router-link to="/terms" class="footer-link">{{ t('legal.footer.terms') }}</router-link>
      </nav>
    </div>
    <p class="mx-auto w-full max-w-6xl px-6 pt-6 text-xs text-muted-gray tabular-nums">
      &copy; {{ year }} Buy The Way
    </p>
  </footer>
</template>

<style scoped>
.footer-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.5rem;
  border-radius: 0.5rem;
  color: var(--charcoal);
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 4px;
  transition: text-decoration-color 200ms ease;
}
.footer-link:hover {
  text-decoration-color: currentColor;
}
.footer-link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.footer-link.router-link-exact-active {
  color: var(--muted-gray);
}
</style>
