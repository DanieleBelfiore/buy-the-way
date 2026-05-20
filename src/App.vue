<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';
import OfflineBanner from '@/components/ui/OfflineBanner.vue';
import UpdatePrompt from '@/components/ui/UpdatePrompt.vue';

// Set <html lang> at app root so it survives route changes (and authenticated
// views that don't call useDocumentHead). axe-core fails serious if it's missing.
const { locale } = useI18n();
useHead({ htmlAttrs: { lang: () => locale.value } });

// Skip view-fade transition under e2e: axe-core reads computed colors and
// catches the mid-fade opacity blend, producing false-positive contrast
// failures. Playwright's prefers-reduced-motion is not reliable enough on
// Vue Transition's initial render, so we hard-disable it via the env flag.
const isE2E = import.meta.env['VITE_E2E'] === 'true';
</script>

<template>
  <OfflineBanner />
  <router-view v-slot="{ Component }">
    <Transition v-if="!isE2E" name="view-fade" mode="out-in">
      <component :is="Component" />
    </Transition>
    <component v-else :is="Component" />
  </router-view>
  <UpdatePrompt />
</template>

<style>
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.view-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.view-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .view-fade-enter-active,
  .view-fade-leave-active {
    transition: none;
  }
  .view-fade-enter-from,
  .view-fade-leave-to {
    transform: none;
    opacity: 1;
  }
}
</style>
