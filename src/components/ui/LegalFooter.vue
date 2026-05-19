<script setup lang="ts">
import { useI18n } from 'vue-i18n';

withDefaults(defineProps<{ dense?: boolean }>(), { dense: false });

const { t } = useI18n();
</script>

<template>
  <footer
    :class="[
      'mx-auto max-w-3xl px-6 text-xs text-muted-gray',
      dense ? 'pt-4 pb-1' : 'pt-6 pb-10',
    ]"
  >
    <nav aria-label="Legal" class="flex flex-wrap justify-center gap-3">
      <router-link to="/about" class="underline">
        {{ t('legal.footer.about') }}
      </router-link>
      <router-link to="/privacy" class="underline">
        {{ t('legal.footer.privacy') }}
      </router-link>
      <router-link to="/terms" class="underline">
        {{ t('legal.footer.terms') }}
      </router-link>
    </nav>
  </footer>
</template>
