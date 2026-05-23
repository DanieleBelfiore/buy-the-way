<script setup lang="ts">
import { useI18n } from 'vue-i18n';

withDefaults(defineProps<{ dense?: boolean }>(), { dense: false });

const { t } = useI18n();
</script>

<template>
  <footer
    :class="[
      'mx-auto max-w-3xl px-6 text-xs text-muted-gray',
      dense ? 'pt-4' : 'pt-6',
    ]"
    :style="{
      paddingBottom: dense
        ? 'max(0.25rem, env(safe-area-inset-bottom))'
        : 'max(2.5rem, env(safe-area-inset-bottom))',
    }"
  >
    <nav aria-label="Legal" class="flex flex-wrap justify-center gap-2">
      <router-link to="/about" class="underline inline-flex items-center min-h-[44px] px-3 py-2">
        {{ t('legal.footer.about') }}
      </router-link>
      <router-link to="/privacy" class="underline inline-flex items-center min-h-[44px] px-3 py-2">
        {{ t('legal.footer.privacy') }}
      </router-link>
      <router-link to="/terms" class="underline inline-flex items-center min-h-[44px] px-3 py-2">
        {{ t('legal.footer.terms') }}
      </router-link>
    </nav>
  </footer>
</template>
